import argparse
import json
import os
import re
from datetime import datetime, timedelta

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore, storage


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.path.join(ROOT_DIR, "config", "service_account.json")
STATIC_DIR = os.path.join(ROOT_DIR, "static")


def load_firestore_and_storage():
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    bucket_name = (os.getenv("FIREBASE_STORAGE_BUCKET") or "").strip()
    if not firebase_admin._apps:
        initialize_kwargs = {"storageBucket": bucket_name} if bucket_name else None
        if initialize_kwargs:
            firebase_admin.initialize_app(cred, initialize_kwargs)
        else:
            firebase_admin.initialize_app(cred)
    return firestore.client()


def bucket_candidates():
    primary = (os.getenv("FIREBASE_STORAGE_BUCKET") or "").strip()
    if primary:
        names = [primary]
    else:
        with open(SERVICE_ACCOUNT_PATH, "r", encoding="utf-8") as fh:
            service_account = json.load(fh)
        project_id = (service_account.get("project_id") or "").strip()
        names = [f"{project_id}.firebasestorage.app"] if project_id else []

    expanded = []
    for name in names:
        if not name:
            continue
        expanded.append(name)
        if name.endswith(".appspot.com"):
            expanded.append(name.replace(".appspot.com", ".firebasestorage.app"))
        elif name.endswith(".firebasestorage.app"):
            expanded.append(name.replace(".firebasestorage.app", ".appspot.com"))
    seen = []
    for name in expanded:
        if name not in seen:
            seen.append(name)
    return seen


def local_audio_path(doc_id: str, audio_url: str) -> str:
    preferred = os.path.join(STATIC_DIR, f"output_{doc_id}.mp3")
    if os.path.exists(preferred):
        return preferred

    match = re.search(r"output_([A-Za-z0-9_-]+)\.mp3", audio_url or "")
    if match:
        alt = os.path.join(STATIC_DIR, f"output_{match.group(1)}.mp3")
        if os.path.exists(alt):
            return alt
    return ""


def upload_audio(file_path: str, doc_id: str):
    with open(file_path, "rb") as fh:
        audio_bytes = fh.read()

    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    storage_path = f"audio/{doc_id}/{ts}.mp3"
    last_error = None
    for bucket_name in bucket_candidates():
        try:
            bucket = storage.bucket(bucket_name)
            blob = bucket.blob(storage_path)
            blob.upload_from_string(audio_bytes, content_type="audio/mpeg")
            url = blob.generate_signed_url(
                expiration=timedelta(days=3650),
                method="GET",
            )
            return url, storage_path, bucket_name, ""
        except Exception as exc:
            last_error = exc
    return "", "", "", str(last_error or "upload failed")


def main():
    parser = argparse.ArgumentParser(description="Upload locally saved output_<id>.mp3 files to Firebase Storage and update Firestore audioUrl.")
    parser.add_argument("--only-id", help="Migrate only one podcast document id.")
    parser.add_argument("--apply", action="store_true", help="Actually write updates to Firestore and upload files.")
    args = parser.parse_args()

    db = load_firestore_and_storage()
    query = db.collection("podcasts")

    migrated = 0
    missing_local = 0
    skipped = 0

    for doc in query.stream():
        if args.only_id and doc.id != args.only_id:
            continue

        data = doc.to_dict() or {}
        audio_url = (data.get("audioUrl") or "").strip()
        if "localhost:5000/static/" not in audio_url and "127.0.0.1:5000/static/" not in audio_url:
            skipped += 1
            continue

        file_path = local_audio_path(doc.id, audio_url)
        if not file_path:
            missing_local += 1
            print(f"MISSING_LOCAL {doc.id} {data.get('title') or 'Untitled'}")
            continue

        print(f"READY {doc.id} -> {file_path}")
        if not args.apply:
            continue

        url, storage_path, bucket_name, error = upload_audio(file_path, doc.id)
        if not url:
            print(f"UPLOAD_FAILED {doc.id} {error}")
            continue

        doc.reference.set(
            {
                "audioUrl": url,
                "audioPath": storage_path,
                "audioBucket": bucket_name,
                "audioUpdatedAt": firestore.SERVER_TIMESTAMP,
                "audioNeedsRegeneration": firestore.DELETE_FIELD,
                "audioNeedsRegenerationReason": firestore.DELETE_FIELD,
            },
            merge=True,
        )
        migrated += 1
        print(f"MIGRATED {doc.id} -> {bucket_name}/{storage_path}")

    print("\nSummary")
    print("-------")
    print(f"Migrated: {migrated}")
    print(f"Missing local file: {missing_local}")
    print(f"Skipped: {skipped}")
    if not args.apply:
        print("Dry run only. Re-run with --apply to perform the migration.")


if __name__ == "__main__":
    main()
