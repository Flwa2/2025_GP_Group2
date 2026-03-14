import argparse
import firebase_admin
import json
import os
import re
from collections import Counter
from datetime import datetime

from dotenv import load_dotenv
from firebase_admin import credentials, firestore, initialize_app


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.path.join(ROOT_DIR, "config", "service_account.json")


def load_firestore():
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    if not firebase_admin._apps:
        initialize_app(cred)
    return firestore.client()


def normalize_public_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if url.startswith("http://") and not re.match(r"^http://(localhost|127\.0\.0\.1)(:|/|$)", url):
        return "https://" + url[len("http://"):]
    return url


def classify_audio_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return "missing"
    if value.startswith("/"):
        return "relative_path"
    if ".firebasestorage.app" in value or ".appspot.com" in value:
        return "firebase_storage"
    if "onrender.com/static/" in value:
        return "render_static"
    if value.startswith("http://"):
        return "http_external"
    if value.startswith("https://"):
        return "https_external"
    return "unknown"


def serialize_ts(value):
    if isinstance(value, datetime):
        return value.isoformat()
    to_datetime = getattr(value, "to_datetime", None)
    if callable(to_datetime):
        try:
            return to_datetime().isoformat()
        except Exception:
            return str(value)
    return value


def audit_docs(db, only_user=None):
    query = db.collection("podcasts")
    if only_user:
        query = query.where("userId", "==", only_user)

    rows = []
    counts = Counter()
    for doc in query.stream():
        data = doc.to_dict() or {}
        audio_url = (data.get("audioUrl") or "").strip()
        normalized = normalize_public_url(audio_url)
        classification = classify_audio_url(normalized)
        counts[classification] += 1
        rows.append(
            {
                "id": doc.id,
                "title": data.get("title") or "",
                "userId": data.get("userId") or "",
                "status": data.get("status") or "",
                "audioUrl": audio_url,
                "normalizedAudioUrl": normalized,
                "audioPath": data.get("audioPath") or "",
                "audioBucket": data.get("audioBucket") or "",
                "classification": classification,
                "savedAt": serialize_ts(data.get("savedAt")),
                "createdAt": serialize_ts(data.get("createdAt")),
            }
        )
    return rows, counts


def maybe_update_docs(db, rows, rewrite_http=False, flag_regen=False):
    updated = 0
    for row in rows:
        updates = {}
        if rewrite_http and row["audioUrl"] and row["audioUrl"] != row["normalizedAudioUrl"]:
            updates["audioUrl"] = row["normalizedAudioUrl"]

        if flag_regen and row["classification"] in {"missing", "relative_path", "render_static"}:
            updates["audioNeedsRegeneration"] = True
            updates["audioNeedsRegenerationReason"] = row["classification"]

        if updates:
            db.collection("podcasts").document(row["id"]).set(updates, merge=True)
            updated += 1
    return updated


def print_summary(rows, counts):
    print("Audio audit summary")
    print("-------------------")
    print(f"Total podcasts scanned: {len(rows)}")
    for key in sorted(counts):
        print(f"{key}: {counts[key]}")

    risky = [r for r in rows if r["classification"] in {"missing", "relative_path", "render_static", "http_external", "unknown"}]
    if risky:
        print("\nRisky records")
        print("-------------")
        for row in risky[:50]:
            print(f"{row['id']} | {row['classification']} | {row['title'] or 'Untitled'}")
            print(f"  {row['audioUrl'] or '<missing>'}")
        if len(risky) > 50:
            print(f"... and {len(risky) - 50} more")


def main():
    parser = argparse.ArgumentParser(description="Audit Firestore podcast audio URLs for Render durability issues.")
    parser.add_argument("--only-user", help="Only scan podcasts for this userId/email.")
    parser.add_argument("--rewrite-http-to-https", action="store_true", help="Rewrite non-localhost http audio URLs to https.")
    parser.add_argument("--flag-needs-regeneration", action="store_true", help="Mark risky records with audioNeedsRegeneration=true.")
    parser.add_argument("--json-out", help="Write the full audit report to a JSON file.")
    args = parser.parse_args()

    db = load_firestore()
    rows, counts = audit_docs(db, only_user=args.only_user)
    print_summary(rows, counts)

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(rows, fh, ensure_ascii=False, indent=2)
        print(f"\nWrote report to {args.json_out}")

    if args.rewrite_http_to_https or args.flag_needs_regeneration:
        updated = maybe_update_docs(
            db,
            rows,
            rewrite_http=args.rewrite_http_to_https,
            flag_regen=args.flag_needs_regeneration,
        )
        print(f"\nUpdated {updated} podcast record(s).")


if __name__ == "__main__":
    main()
