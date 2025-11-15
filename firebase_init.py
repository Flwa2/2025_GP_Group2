import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("config/service_account.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# This MUST return a real Firestore client, not None
db = firestore.client()