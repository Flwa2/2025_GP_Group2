import firebase_admin
from firebase_admin import credentials, firestore, storage
import json
import os

SERVICE_ACCOUNT_PATH = "config/service_account.json"
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)

storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET", "").strip()
if not storage_bucket:
    try:
        with open(SERVICE_ACCOUNT_PATH, "r", encoding="utf-8") as fh:
            service_account = json.load(fh)
            project_id = (service_account.get("project_id") or "").strip()
            if project_id:
                storage_bucket = f"{project_id}.firebasestorage.app"
    except Exception:
        storage_bucket = ""

if not firebase_admin._apps:
    options = {"storageBucket": storage_bucket} if storage_bucket else None
    firebase_admin.initialize_app(cred, options)


db = firestore.client()


def get_storage_bucket():
    return storage.bucket()
