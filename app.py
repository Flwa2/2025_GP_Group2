# app.py

from flask import (
    Flask,
    request,
    redirect,
    url_for,
    session,
    jsonify,
)
from flask_cors import CORS
from flask_session import Session
from dotenv import load_dotenv
from openai import OpenAI
from pydub import AudioSegment
from shutil import which
from io import BytesIO
from elevenlabs.client import ElevenLabs
import os
import re
import requests
import base64
from firebase_admin import firestore
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import jwt
from firebase_init import db  

print("🔍 DEBUG in app.py:", db)

SHOW_TITLE_PLACEHOLDER = "{{SHOW_TITLE}}"
# ------------------------------------------------------------
# App + Config
# ------------------------------------------------------------

app = Flask(__name__)
FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://wecast-frontend.onrender.com",  
]

CORS(
    app,
    resources={r"/*": {"origins": FRONTEND_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"],
)

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in FRONTEND_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


# Server-side sessions 
app.config.update(
    SECRET_KEY= "WeCast2025", 
    SESSION_TYPE="filesystem", 
    SESSION_FILE_DIR="./.flask_session",
    SESSION_PERMANENT=False,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  
)
Session(app)

# Load .env variables configuring ffmpeg for pydub
load_dotenv()

# Get ffmpeg & ffprobe paths from .env
ffmpeg_path = os.getenv("FFMPEG_PATH")
ffprobe_path = os.getenv("FFPROBE_PATH")

print("DEBUG ffmpeg_path:", ffmpeg_path)
print("DEBUG ffprobe_path:", ffprobe_path)

# If the paths exist, configure pydub AND PATH
if ffmpeg_path and os.path.exists(ffmpeg_path):
    AudioSegment.converter = ffmpeg_path
    ffmpeg_dir = os.path.dirname(ffmpeg_path)
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
else:
    print("⚠️ ffmpeg_path missing or invalid")

if ffprobe_path and os.path.exists(ffprobe_path):
    AudioSegment.ffprobe = ffprobe_path
    ffprobe_dir = os.path.dirname(ffprobe_path)
    if ffprobe_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffprobe_dir + os.pathsep + os.environ.get("PATH", "")
else:
    print("⚠️ ffprobe_path missing or invalid")

print("DEBUG AudioSegment.converter:", getattr(AudioSegment, "converter", None))
print("DEBUG AudioSegment.ffprobe:", getattr(AudioSegment, "ffprobe", None))
print("DEBUG PATH starts with:", os.environ["PATH"].split(os.pathsep)[0])


app.secret_key = app.config["SECRET_KEY"]



def create_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    return token


def get_current_user_email():
    """Read JWT from Authorization header and return the email inside it."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload.get("email") or payload.get("user_id")
    except Exception as e:
        print("JWT decode failed:", e)
        return None

# ------------------------------------------------------------
# API Clients (OpenAI + ElevenLabs)
# ------------------------------------------------------------
# OpenAI client for script + title generation
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)
# ElevenLabs client for multi speaker TTS
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
print("ELEVENLABS_API_KEY present?", bool(ELEVENLABS_API_KEY))

if not ELEVENLABS_API_KEY:
    raise RuntimeError(
        "ELEVENLABS_API_KEY is missing. Add it to .env next to app.py:\n"
        "ELEVENLABS_API_KEY=xi_************************"
    )

voice_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def is_arabic(text: str) -> bool:
    """
    Detect if text is *mostly* Arabic.
    Returns True only if a reasonable percentage of letters are Arabic.
    """
    if not text:
        return False

    arabic_letters = 0
    total_letters = 0

    for c in text:
        if c.isalpha():
            total_letters += 1
            if "\u0600" <= c <= "\u06FF" or "\u0750" <= c <= "\u08FF":
                arabic_letters += 1

    if total_letters == 0:
        return False

    # tweak this threshold if you want, 0.3 = 30% of letters
    return (arabic_letters / total_letters) >= 0.30


def detect_language(description: str) -> str:
    return "ar" if is_arabic(description) else "en"


def save_generated_podcast_to_firestore(user_id: str, title: str, script_style: str,
                                       description: str, script: str, speakers_info: list):
    # 1) Create the podcast doc with an auto-ID
    podcast_ref = db.collection("podcasts").document()
    podcast_id = podcast_ref.id

    now = firestore.SERVER_TIMESTAMP
    language = detect_language(description)

    # Podcast doc
    podcast_ref.set({
        "userId": user_id,
        "title": title or "Untitled Episode",
        "language": language,
        "style": script_style,
        "speakersCount": len(speakers_info or []),
        "status": "draft",
        "createdAt": now,
        "lastEditedAt": now,
    })

    # 2) Speakers subcollection
    speakers_col = podcast_ref.collection("speakers")
    for s in speakers_info or []:
        speakers_col.document().set({
            "name": (s.get("name") or "").strip(),
            "gender": (s.get("gender") or "").strip(),
            "role": (s.get("role") or "").strip(),
            "providerVoiceId": (s.get("voiceId") or "").strip(),  # your frontend uses voiceId
            "createdAt": now,
        })

    # 3) Script doc (single doc, id = "main")
    script_ref = podcast_ref.collection("scripts").document("main")
    script_ref.set({
        "sourceText": description,
        "finalScriptText": script,
        "wordCount": len((script or "").split()),
        "createdAt": now,
        "lastEditedAt": now,
    })

    return podcast_id

def generate_podcast_script(description: str, speakers_info: list, script_style: str):
    """Generate a structured podcast script where ALL speakers talk,
    and remove only headings and bracket lines without touching the real script content.
    """

    # Detect Arabic
    arabic_instruction = (
        "Please write the script in Arabic." if is_arabic(description) else ""
    )
    is_ar = is_arabic(description)

    if is_ar:
            intro_block = """
            --------------------
            INTRO
            --------------------
            - يجب أن تكون أول جملة منطوقة في المقدمة من المقدم الرئيسي (أول متحدث في القائمة).
    - يجب أن تحتوي هذه الجملة على {{SHOW_TITLE}} حرفيًا داخل علامات اقتباس، مثال:
    <اسم_المقدم>: مرحبًا بكم في حلقة جديدة من "{{SHOW_TITLE}}".
    - بعد هذه الجملة، أكمل المقدمة بتقديم الموضوع والمتحدثين بشكل طبيعي.
    """
    else:
            intro_block = """
            --------------------
            INTRO
            --------------------
           - Start with: Host greets listeners and says something NATURAL like:
    "<HostName>: Welcome to our podcast '{{SHOW_TITLE}}'."
    OR
    "<HostName>: Hello and welcome to '{{SHOW_TITLE}}'."
    OR
    "<HostName>: Thanks for joining us on '{{SHOW_TITLE}}'."
    - DO NOT use the phrase "Welcome to another episode of" or "Welcome to another episode".
    - Use more natural, varied opening greetings.
    - Then introduce the topic + speakers naturally.
            """

    # Format speakers list for GPT
    num_speakers = len(speakers_info)
    speaker_info_text = "\n".join(
        [f"- {s['name']} ({s['gender']}, {s['role']})" for s in speakers_info]
    )

    # Style guidelines used in prompt
    style_guidelines = {
        "Interview": """
• Tone: Professional, journalistic.
• Flow: Host asks, guest answers.
• Turn-taking: MUST alternate speakers.
• Goal: Insightful conversation.
""",
        "Storytelling": """
• Tone: Cinematic and narrative.
• Flow: Story with emotional beats.
• Turn-taking: All speakers appear in intro, body, outro.
• Goal: Immersive storytelling.
""",
        "Educational": """
• Tone: Clear and helpful.
• Flow: Explain → clarify → examples.
• Turn-taking: Host + guests engage.
• Goal: Learn through dialogue.
""",
        "Conversational": """
• Tone: Friendly and natural.
• Flow: Co-host casual conversation.
• Turn-taking: Hosts react and alternate often.
• Goal: Feel like real conversation.
""",
    }

    style_rules = style_guidelines.get(script_style, "")

    # FULL PROMPT FOR GPT
    prompt = f"""
You are a professional podcast scriptwriter.

There should be exactly {num_speakers} speaker(s). Use these exact labels:

{speaker_info_text}

Format the content into a natural podcast script. Do not exceed or invent story details.

STYLE: {script_style}

Follow these requirements:
{intro_block}

--------------------
BODY
--------------------
- Natural dialogue.
- All speakers MUST speak multiple times.
- Turn-taking is REQUIRED.

--------------------
OUTRO
--------------------
- Summary or closing thoughts.

--------------------
RULES
--------------------
- The script MUST contain three sections in this exact format:

--------------------
INTRO
--------------------
[music]
[script content here]
[music]

--------------------
BODY
--------------------
[script content here]
--------------------
OUTRO
--------------------
[music]
[script content here]
[music]

- Do NOT add any extra music tags.
- Do NOT put music in the middle of dialogue.
- Every spoken line MUST begin with: SpeakerName:
- Do NOT use bullet points inside the script.
- Do NOT use markdown (#, ##, ### headings).
- Sound cues must be inside square brackets.
- Keep the script natural and flowing.

SPEAKER RULES (MANDATORY — DO NOT VIOLATE):
- Speaker Interaction Rule: When a speaker replies, they should naturally reference the other speaker's label when appropriate during conversation. Speakers MUST address each other using the exact labels provided (example: if speakers are x and v, then the script may contain: "That’s interesting, v." or "What do you think, x?").
- Keep speaker labels EXACTLY as written in the input (example: ga, ha, sp, user, narrator).
- Do NOT rename, modify, expand, substitute, or invent new speaker names.
- If the original text contains: "ga:", "ha:" or any label format, use them EXACTLY.
- DO NOT convert them to human names or fictional identities.
- If a line does not have a speaker label, DO NOT create one.
- Output must preserve speaker labeling format literally.

TRANSITION SPEECH RULES (VERY IMPORTANT):

- The sentence immediately BEFORE a [music] tag must sound like a natural ending, conclusion, or pause. 
- Do NOT end abruptly. End with tone markers such as:
  • a reflective closing thought
  • a conversational wrap-up
  • a gentle shift phrase such as:
      "We'll continue right after this..."
      "More on that in a moment."
      "Let's pause for a second."

- The FIRST sentence after a [music] tag must feel like a fresh beginning or a smooth re-entry. 
- Use natural re-entry language like:
      "Welcome back—"
      "Now let’s continue—"
      "Picking up where we left off—"
      "So now—"

- DO NOT be robotic or repetitive. 
- Tone must feel intentional, confident, and designed for audio.

{arabic_instruction}

Transform the following text into a structured podcast script:

[TEXT START]
{description}
[TEXT END]
"""

    # ---- Call GPT ----
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You write natural, structured podcast scripts with correct speaker dialogue."
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.75,
    )

    raw_script = response.choices[0].message.content.strip()
    PLACEHOLDER = SHOW_TITLE_PLACEHOLDER  

    if PLACEHOLDER not in raw_script:
        raw_script = re.sub(r"\{SHOW_TITLE\}", PLACEHOLDER, raw_script)
        raw_script = re.sub(r"\bSHOW_TITLE\b", PLACEHOLDER, raw_script)

    if PLACEHOLDER not in raw_script:
        m = re.search(
            r"(episode of\s+[\"“'«])(.+?)([\"”'»])",
            raw_script,
            flags=re.IGNORECASE,
        )
        if m:
            bad_title = m.group(2)
            raw_script = raw_script.replace(bad_title, PLACEHOLDER, 1)

    if PLACEHOLDER not in raw_script and is_arabic(raw_script):
        m = re.search(
            r"(?:حلقة جديدة من|حلقة من|من)\s*[\"“«](.+?)[\"”»]",
            raw_script,
        )
        if m:
            bad_title = m.group(1)
            raw_script = raw_script.replace(bad_title, PLACEHOLDER, 1)

    # ============================================================
    # 🧹 CLEAN ONLY BAD LINES — DO NOT DELETE MAIN SCRIPT
    # ============================================================
    cleaned_lines = []
    for ln in raw_script.splitlines():
        stripped = ln.strip()

        # remove markdown headings like "# Intro", "### BODY"
        if re.match(r"^#{1,6}\s+\w+", stripped):
            continue

        # remove bracket-only lines EXCEPT [music]
        if re.fullmatch(r"\[[^\]]+\]", stripped):
            if stripped.lower() != "[music]":
                continue

        cleaned_lines.append(ln)

    cleaned_raw = "\n".join(cleaned_lines)


    final_script = cleaned_raw

    return final_script


def generate_title_from_script(script: str, script_style: str = "") -> str:
    """Generate a short, catchy podcast episode title (4–8 words)."""

    text = script or ""
    if not text.strip():
        return "Untitled Episode"

    # Detect language from the script itself
    is_ar = is_arabic(text)
    style_label = script_style or ("تعليمي" if is_ar else "General")

    if is_ar:
        # Arabic title instructions
        prompt = f"""
أنت كاتب عناوين لبودكاست.

اكتب عنوانًا واحدًا قصيرًا وجذابًا لحلقة بودكاست
مكوّنًا من ٤ إلى ٨ كلمات تقريبًا.

القواعد:
- العنوان باللغة العربية فقط.
- لا تضع أرقام للحلقات.
- لا تستخدم علامات اقتباس أو إيموجي.
- أعد سطرًا واحدًا يحتوي على العنوان فقط بدون أي شرح إضافي.

نمط الحلقة: {style_label}

النص:
\"\"\"{text[:4000]}\"\"\"        
"""
    else:
        prompt = f"""
You are an assistant helping to name a podcast episode.

Write ONE short, catchy podcast episode title in 4–8 words.

Style: {style_label}

Rules:
- No quotation marks.
- No episode numbers.
- No emojis.
- Title case (Capitalize Major Words).
- Return ONLY the title text, nothing else.

Script:
\"\"\"{text[:4000]}\"\"\"        
"""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You write concise, catchy podcast titles in the same language as the script.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )

    title = (resp.choices[0].message.content or "").strip()
    title = title.strip('"“”«»').strip()

    if not title:
        return "حلقة بدون عنوان" if is_ar else "Untitled Episode"

    return title


def validate_roles(style: str, speakers_info: list):
    roles = [s["role"] for s in speakers_info]

    if style == "Interview":
        return (
            roles in [["host", "guest"], ["host", "host", "guest"]],
            "For 'Interview' style, valid setups: 1 host → 1 guest or 2 hosts → 1 guest.",
        )

    if style == "Storytelling":
        return (
            roles in [["host"], ["host", "guest"], ["host", "guest", "guest"]],
            "For 'Storytelling' style, valid setups: 1 host solo, 1 host → 1 guest, or 1 host → 2 guests.",
        )

    if style == "Educational":
        return (
            roles in [["host"], ["host", "guest"], ["host", "guest", "guest"]],
            "For 'Educational' style, valid setups: 1 host solo, 1 host → 1 guest, or 1 host → 2 guests.",
        )

    if style == "Conversational":
        return (
            roles in [["host", "host"], ["host", "host", "host"]],
            "For 'Conversational', use 2–3 hosts (no guests).",
        )

    return (True, "")

def chars_to_words(text: str, ch_starts: list, ch_ends: list):
    """
    Convert character-level timestamps to word-level.
    Returns list of dicts: {w, start, end}
    """
    words = []
    if not text:
        return words

    n = min(len(text), len(ch_starts), len(ch_ends))
    i = 0

    while i < n:
        if text[i].isspace():
            i += 1
            continue

        start_i = i
        start_t = ch_starts[i]

        while i < n and not text[i].isspace():
            i += 1

        end_i = i - 1
        end_t = ch_ends[end_i]

        token = text[start_i:i].strip()
        if token:
            words.append({"w": token, "start": float(start_t), "end": float(end_t)})

    return words

def eleven_tts_with_timestamps(text: str, voice_id: str, model_id: str = "eleven_multilingual_v2"):
    """
    Returns: (audio_bytes, word_timings_for_this_segment)
    word timings are relative to segment start (0.0)
    """
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = {
        "text": text,
        "model_id": model_id,
        "output_format": "mp3_44100_128",
    }

    r = requests.post(url, headers=headers, json=body, timeout=120)
    if not r.ok:
        raise RuntimeError(f"ElevenLabs error {r.status_code}: {r.text[:300]}")

    data = r.json()
    audio_b64 = data.get("audio_base64")
    if not audio_b64:
        raise RuntimeError("Missing audio_base64 in ElevenLabs response.")

    audio_bytes = base64.b64decode(audio_b64)

    alignment = data.get("alignment") or {}
    ch_starts = alignment.get("character_start_times_seconds") or []
    ch_ends = alignment.get("character_end_times_seconds") or []

    # Convert char timings to words using the exact same text we sent
    words = chars_to_words(text, ch_starts, ch_ends)

    return audio_bytes, words

@app.get("/api/health")
def health():
    return jsonify(status="ok")

# get list of available ElevenLabs voices
@app.get("/api/voices")
def api_voices():
    """
    Return all available ElevenLabs voices.
    Shape: { "voices": [ { "id", "name", "labels", "preview_url" }, ... ] }
    """
    try:
        res = voice_client.voices.get_all()
        voices = []
        for v in getattr(res, "voices", []):
            preview = getattr(v, "preview_url", None)
            if not preview and getattr(v, "samples", None):
                if v.samples:
                    preview = getattr(v.samples[0], "preview_url", None)

            voices.append(
                {
                    "id": v.voice_id,
                    "name": v.name,
                    "labels": getattr(v, "labels", {}),
                    "preview_url": preview,
                }
            )
        return jsonify(voices=voices)
    except Exception as e:
        print("ELEVENLABS /api/voices ERROR:", e)
        return jsonify(error=str(e), voices=[]), 500


@app.get("/api/me")
def api_me():
    """
    Return the logged-in user's basic profile from Firestore.
    Uses the session user_id set during /api/login or /api/social-login.
    """
    user_id = session.get("user_id")  # we stored email as user_id on login
    if not user_id:
        return jsonify(error="Not logged in"), 401

    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()

    if not doc.exists:
        return jsonify(error="User not found"), 404

    data = doc.to_dict() or {}

    return jsonify(
        email=data.get("email", user_id),
        displayName=data.get("name", "WeCast User"),
        handle=data.get("handle", "@wecast"),
    )


@app.post("/api/generate")
def api_generate():
    data = request.get_json(force=True)
    script_style = (data.get("script_style") or "").strip()
    speakers = int(data.get("speakers") or 0)
    speakers_info = data.get("speakers_info") or []
    description = (data.get("description") or "").strip()

    ok, msg = validate_roles(script_style, speakers_info)
    if not ok:
        return jsonify(ok=False, error=msg), 400
    if not script_style:
        return jsonify(ok=False, error="Please choose a podcast style."), 400
    if speakers not in (1, 2, 3):
        return jsonify(ok=False, error="Invalid speakers count."), 400
    if len(description.split()) < 500:
        return jsonify(ok=False, error="Your text must be at least 500 words."), 400

    script = generate_podcast_script(description, speakers_info, script_style)

    title = generate_title_from_script(script, script_style)

    script_template = script  
    show_title = title or "Podcast Show"
    # ✅ figure out user (prefer session)
    user_id = session.get("user_id")
    if not user_id:
        # fallback to JWT header if you want
        user_id = get_current_user_email()

    # If you require login to save, enforce it
    if not user_id:
        return jsonify(ok=False, error="Not logged in."), 401

    podcast_id = save_generated_podcast_to_firestore(
        user_id=user_id,
        title=title,
        script_style=script_style,
        description=description,
        script=script_template,
        speakers_info=speakers_info,
    )


    session["create_draft"] = {
        "podcastId": podcast_id,
        "script_style": script_style,
        "speakers_count": speakers,
        "speakers_info": speakers_info,
        "description": description,
        "script": script_template,
        "show_title": show_title,
        "title": title,
    }


    return jsonify(ok=True, script=script_template, title=title, show_title=show_title, podcastId=podcast_id)

@app.get("/api/draft")
def api_draft():
    # React editor uses this to prefill the textarea
    return jsonify(session.get("create_draft", {}))

@app.post("/api/edit/save")
def api_edit_save():
    """
    Save edited script (and optionally updated title).
    - دائماً نحدّث session["create_draft"]
    - وإذا فيه user_id في الـ session، نخزن نفس الشيء في Firestore أيضاً
    """
    data = request.get_json(silent=True) or {}
    edited_script = (data.get("edited_script") or "").strip()
    show_title = (data.get("show_title") or "").strip()

    if not edited_script:
        return jsonify({"ok": False, "error": "Edited script is empty"}), 400

    # 1) حدّث الـ session draft
    draft = session.get("create_draft") or {}
    draft["script"] = edited_script

    if show_title:
        draft["show_title"] = show_title
        draft["title"] = show_title

    session["create_draft"] = draft
    session.modified = True

    # 2) لو المستخدم مسجل دخول، خزّن نسخة في Firestore
    user_id = session.get("user_id")
    if user_id:
        draft_ref = db.collection("drafts").document(user_id)
        draft_ref.set(
            {
                "script": edited_script,
                "show_title": show_title,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

    podcast_id = (session.get("create_draft") or {}).get("podcastId")
    if user_id and podcast_id:
        script_ref = db.collection("podcasts").document(podcast_id).collection("scripts").document("main")
        script_ref.set({
            "finalScriptText": edited_script,
            "wordCount": len(edited_script.split()),
            "lastEditedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

        db.collection("podcasts").document(podcast_id).set({
            "title": show_title or draft.get("title") or "Untitled Episode",
            "lastEditedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return jsonify({
        "ok": True,
        "show_title": draft.get("show_title", ""),
        "title": draft.get("title", ""),
    })




def clean_script_for_tts(script: str) -> str:
    """
    Create a clean text version for TTS:
    - Remove speaker labels
    - Remove formatting leftovers (ga:, fe:, -, bullet points, unicode spaces)
    - Remove tags and markdown
    - Keep only natural spoken text
    """
    cleaned_lines = []

    for raw in script.splitlines():
        line = raw.strip()
        if not line:
            continue

        if line.startswith("#"):
            continue

        if re.fullmatch(r"(intro|body|outro)[:：]?\s*$", line, re.IGNORECASE):
            continue

        if re.match(r"^([^:：]+)[:：]\s*(intro|body|outro)\s*$", line, re.IGNORECASE):
            continue

        if re.fullmatch(r"\[[^\]]+\]", line):
            if line.lower() != "[music]":
                continue

        line = re.sub(r"\[[^\]]*]", "", line)

        line = re.sub(r"[\u200B-\u200D\uFEFF]", "", line)

        if re.fullmatch(r"[-_=*~•·\u2022]{2,}", line):
            continue

        line = re.sub(r"^[A-Za-z0-9]{1,10}\s*[:：]\s*", "", line)

        line = re.sub(r"^[^\w]+", "", line)
        line = re.sub(r"\s{2,}", " ", line).strip()

        if line:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)

def build_speaker_voice_map():
    """
    Build a mapping: speaker_name -> voiceId
    plus a default voice (host voice if available).
    """
    draft = session.get("create_draft") or {}
    speakers_info = draft.get("speakers_info") or []

    mapping = {}
    host_voice = None
    any_voice = None

    for s in speakers_info:
        name = (s.get("name") or "").strip()
        vid = (s.get("voiceId") or "").strip()
        if not name or not vid:
            continue

        mapping[name] = vid
        if not any_voice:
            any_voice = vid
        if s.get("role") == "host" and not host_voice:
            host_voice = vid

    default_voice = host_voice or any_voice or "21m00Tcm4TlvDq8ikWAM"
    return mapping, default_voice

def parse_script_into_segments(script: str):
    """
    Turn the script into segments: [(speaker_name, text), ...]
    - ignore markdown headings (#..)
    - ignore INTRO/BODY/OUTRO headers
    - ignore separator lines (----)
    - lines without label keep the previous speaker
    - Literal parser: KEEP speaker labels exactly as written.
    - Only treat '[music]' as a special segment.
    """
    segments = []
    last_speaker = None
    for raw in script.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue

        if stripped.lower() == "[music]":
            segments.append(("__music__", None))
            continue

        if ":" in stripped:
            speaker, text = stripped.split(":", 1)
            speaker = speaker.strip()
            text = text.strip()

            if text:
                segments.append((speaker, text))
                last_speaker = speaker
            continue

        if last_speaker:
            segments.append((last_speaker, stripped))

    return segments

def synthesize_audio_from_script(script: str):
    music_index = 0
    script = (script or "").strip()
    if not script:
        return False, "Script is empty."

    segments = parse_script_into_segments(script)
    if not segments:
        return False, "Nothing to read after cleaning script."

    speaker_to_voice, default_voice = build_speaker_voice_map()

    audio_parts = []
    word_timeline = []
    timeline_offset = 0.0  # seconds

    for speaker, text in segments:

        # ----------------------
        # MUSIC SEGMENT
        # ----------------------
        if speaker.strip().lower() == "__music__":
            intro = session.get("introMusic", "")
            body = session.get("bodyMusic", "")
            outro = session.get("outroMusic", "")

            if music_index == 0:
                selected_music = intro
            elif music_index in (1, 2):
                selected_music = body
            else:
                selected_music = outro

            music_index += 1

            if selected_music:
                music_path = os.path.join("static", "music", selected_music)
                if os.path.exists(music_path):
                    music_clip = AudioSegment.from_mp3(music_path)
                    audio_parts.append(music_clip)

                    # advance offset
                    timeline_offset += (len(music_clip) / 1000.0)

            continue

        # ----------------------
        # SPEECH SEGMENT
        # ----------------------
        if is_arabic(text):
            tts_text = text.strip()
        else:
            tts_text = clean_script_for_tts(text)

        if not tts_text.strip():
            continue

        voice_id = speaker_to_voice.get(speaker, default_voice)

        try:
            audio_bytes, segment_words = eleven_tts_with_timestamps(
                text=tts_text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
            )
        except Exception as e:
            return False, str(e)

        speech_segment = AudioSegment.from_file(BytesIO(audio_bytes), format="mp3")
        audio_parts.append(speech_segment)

        # shift segment words to global timeline
        for w in segment_words:
            word_timeline.append({
                "w": w["w"],
                "start": w["start"] + timeline_offset,
                "end": w["end"] + timeline_offset,
                "speaker": speaker,
            })

        # advance offset by this speech duration
        timeline_offset += (len(speech_segment) / 1000.0)

    if not audio_parts:
        return False, "No audio data generated."

    final_audio = AudioSegment.silent(duration=500)
    timeline_offset_final = 0.5  # because we added 500ms silence

    # shift EVERYTHING by 0.5 sec to match the initial silence
    for w in word_timeline:
        w["start"] += timeline_offset_final
        w["end"] += timeline_offset_final

    for item in audio_parts:
        final_audio += item

    output_path = os.path.join("static", "output.mp3")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_audio.export(output_path, format="mp3")

    file_url = url_for("static", filename="output.mp3", _external=True)

    # store last transcript in session too (optional but useful)
    session["last_word_timeline"] = word_timeline
    session.modified = True

    return True, {"url": file_url, "words": word_timeline}

@app.post("/api/audio")
def api_audio():
    payload = request.get_json(silent=True) or {}

    script = (payload.get("scriptText") or request.form.get("scriptText") or "").strip()
    podcast_id = (payload.get("podcastId") or "").strip()   # ✅ NEW

    print("DEBUG /api/audio script length:", len(script))
    print("DEBUG /api/audio first 200 chars:", script[:200])
    print("DEBUG /api/audio podcastId:", podcast_id)

    ok, result = synthesize_audio_from_script(script)
    if not ok:
        print("ERROR /api/audio:", result)
        return jsonify(error=result), 400

    # keep audio in session (as you want)
    session["last_audio_url"] = result["url"]
    session.modified = True

    # ✅ NEW: save live transcript (word timeline) to Firestore
    user_id = session.get("user_id") or get_current_user_email()
    if user_id and podcast_id:
        podcast_ref = db.collection("podcasts").document(podcast_id)
        doc = podcast_ref.get()

        if doc.exists:
            pdata = doc.to_dict() or {}
            if pdata.get("userId") == user_id:
                words = result.get("words") or []
                transcript_text = " ".join([(w.get("w") or "") for w in words]).strip()

                # Save transcript text in main podcast doc (small)
                podcast_ref.set({
                    "transcriptText": transcript_text,
                    "transcriptUpdatedAt": firestore.SERVER_TIMESTAMP,
                }, merge=True)

                # Save full word timeline in a subcollection doc
                podcast_ref.collection("transcripts").document("main").set({
                    "words": words,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                }, merge=True)
            else:
                print("WARN: user does not own this podcast. Not saving transcript.")
        else:
            print("WARN: podcastId not found. Not saving transcript.")

    return jsonify(url=result["url"], words=result["words"])

@app.get("/api/transcript/last")
def api_transcript_last():
    words = session.get("last_word_timeline") or None
    return jsonify(words=words)

@app.post('/api/summarize')
def summarize_transcript():
    """
        Generate an AI summary of the podcast transcript using OpenAI.

        Expects JSON:
        {
        "podcastId": "podcast document ID",
        "text": "full transcript text"
        }

        Returns:
        {
        "summary": "generated summary text"
        }

        Side effect:
        - Saves the summary to Firestore under podcasts/{podcastId}.summary
    """

    try:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '')
        podcast_id = (data.get('podcastId') or "").strip()

        if not text:
            return jsonify({"error": "No text provided"}), 400
        if not podcast_id:
            return jsonify({"error": "Missing podcastId"}), 400

        # (optional) ensure logged in
        user_id = session.get("user_id") or get_current_user_email()
        if not user_id:
            return jsonify({"error": "Not logged in"}), 401

        text = text[:12000]
        is_ar = is_arabic(text)

        if is_ar:
            system_prompt = "أنت مساعد مفيد يقوم بإنشاء ملخصات بودكاست موجزة. يجب أن تكون جميع الردود بحد أقصى 250 كلمة."
            user_prompt = f"يرجى تلخيص نص البودكاست التالي بحد أقصى 250 كلمة. ركز على النقاط الرئيسية والأفكار المهمة:\n\n{text}"
        else:
            system_prompt = "You are a helpful assistant that creates concise podcast summaries. Always respond with 250 words or less."
            user_prompt = f"Please summarize this podcast transcript in 250 words or less. Focus on the main points, key insights, and important discussions:\n\n{text}"

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=350,
            temperature=0.7
        )

        summary = (response.choices[0].message.content or "").strip()

        # enforce <= 250 words
        words = summary.split()
        if len(words) > 250:
            summary = " ".join(words[:250]) + "..."

        # ✅ Save into Firestore (and ensure ownership)
        podcast_ref = db.collection("podcasts").document(podcast_id)
        doc = podcast_ref.get()
        if not doc.exists:
            return jsonify({"error": "Podcast not found"}), 404

        pdata = doc.to_dict() or {}
        if pdata.get("userId") != user_id:
            return jsonify({"error": "Forbidden"}), 403

        podcast_ref.set({
            "summary": summary,
            "summaryUpdatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

        return jsonify({"summary": summary})

    except Exception as e:
        print(f"Summary generation error: {str(e)}")
        return jsonify({"error": "Failed to generate summary"}), 500


@app.get("/api/podcasts/<podcast_id>")
def get_podcast(podcast_id):
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    ref = db.collection("podcasts").document(podcast_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify(error="Podcast not found"), 404

    data = doc.to_dict() or {}
    if data.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    return jsonify(ok=True, podcast={**data, "id": podcast_id})


@app.post("/api/save-music")
def save_music():
    data = request.get_json() or {}
    session["introMusic"] = data.get("introMusic", "")
    session["bodyMusic"] = data.get("bodyMusic", "")
    session["outroMusic"] = data.get("outroMusic", "")

    return jsonify(ok=True)

# ------------------------------------------------------------
# ------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    return redirect("http://localhost:5173/", code=302)

@app.get("/api/audio/last")
def api_audio_last():
    """
    Return the last generated audio URL for this session, if any.
    Used so the audio does not 'disappear' after refresh or navigation.
    """
    url = session.get("last_audio_url")
    return jsonify(url=url or None)

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    name = (data.get("name") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if len(password) < 8:
        return jsonify(
            {"error": "Password must be at least 8 characters long."}
        ), 400

    if not re.search(r"[A-Z]", password) or not re.search(r"\d", password) or not re.search(r"[^A-Za-z0-9]", password):
        return jsonify(
            {
                "error": (
                    "Password must be at least 8 characters and include one "
                    "uppercase letter, one number, and one special symbol."
                )
            }
        ), 400

    user_ref = db.collection("users").document(email)
    if user_ref.get().exists:
        return jsonify({"error": "This email is already in use."}), 409

    password_hash = generate_password_hash(password)

    user_ref.set(
        {
            "email": email,
            "name": name or "",
            "password_hash": password_hash,
            "created_at": datetime.utcnow().isoformat(),
            "role": "user",
            "failed_attempts": 0,
            "lock_until": None,
        }
    )

    token = create_token(email, email)

    return (
        jsonify(
            {
                "message": "User created successfully",
                "token": token,
                "user": {
                    "email": email,
                    "name": name or "",
                    "role": "user",
                },
            }
        ),
        201,
    )

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user_ref = db.collection("users").document(email)
    doc = user_ref.get()

    if not doc.exists:
        return jsonify({"error": "Invalid email or password"}), 401

    user_data = doc.to_dict()
    stored_hash = user_data.get("password_hash")

    if not check_password_hash(stored_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(email, email)
    
    session["user_id"] = email
    session.modified = True

    return (
        jsonify(
            {
                "message": "Login successful",
                "token": token,
                "user": {
                    "email": user_data.get("email"),
                    "name": user_data.get("name"),
                    "role": user_data.get("role", "user"),
                },
            }
        ),
        200,
    )

@app.post("/api/reset-password-direct")
def reset_password_direct():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not email or not new_password or not confirm_password:
        return jsonify(error="All fields are required."), 400

    if new_password != confirm_password:
        return jsonify(error="Passwords do not match."), 400

    if len(new_password) < 8:
        return jsonify(error="Password must be at least 8 characters long."), 400

    if (
        not re.search(r"[A-Z]", new_password)
        or not re.search(r"\d", new_password)
        or not re.search(r"[^A-Za-z0-9]", new_password)
    ):
        return jsonify(
            {
                "error": (
                    "Password must be at least 8 characters and include one "
                    "uppercase letter, one number, and one special symbol."
                )
            }
        ), 400

    user_ref = db.collection("users").document(email)
    doc = user_ref.get()

    if not doc.exists:
        return jsonify(error="Email is not registered."), 404

    new_hash = generate_password_hash(new_password)
    user_ref.update(
        {
            "password_hash": new_hash,
            "failed_attempts": 0,
            "lock_until": None,
        }
    )

    return jsonify(message="Password updated successfully. You can now log in."), 200

@app.post("/api/social-login")
def social_login():
    from firebase_admin import auth as fb_auth

    data = request.get_json(silent=True) or {}
    id_token = data.get("idToken")

    if not id_token:
        return jsonify(error="Missing Firebase ID token"), 400

    try:
        decoded = fb_auth.verify_id_token(id_token)
        email = decoded.get("email")
        name = decoded.get("name") or ""

        if not email:
            return jsonify(error="Unable to read email from Firebase token"), 400

        user_ref = db.collection("users").document(email)
        doc = user_ref.get()

        auth_provider = decoded.get("firebase", {}).get("sign_in_provider", "oauth")

        if not doc.exists:
            # Create new user
            user_ref.set({
                "email": email,
                "name": name,
                "authProvider": auth_provider,
                "created_at": datetime.utcnow().isoformat(),
                "last_login": datetime.utcnow().isoformat(),
                "role": "user",
                "password_hash": None,
            })
        else:
            user_ref.update({
                "name": name,  
                "authProvider": auth_provider,
                "last_login": datetime.utcnow().isoformat(),
            })


        token = create_token(email, email)

        session["user_id"] = email
        session.modified = True

        return jsonify(
            message="Login successful",
            token=token,
            user={"email": email, "name": name, "role": "user"},
        )

    except Exception as e:
        print("🔥 OAuth login error:", e)
        return jsonify(error="Invalid or expired OAuth token"), 401

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)
