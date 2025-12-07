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
    "https://wecast.onrender.com",  # put your real Render frontend here
]

# CORS configuration: allow React (localhost:5173) to call this backend
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


# Server-side sessions (for create_draft, etc.)
app.config.update(
    SECRET_KEY= "WeCast2025", # used for Flask sessions and JWT
    SESSION_TYPE="filesystem",  # store sessions on disk
    SESSION_FILE_DIR="./.flask_session",
    SESSION_PERMANENT=False,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # HTTP, not HTTPS
)
Session(app)

# Load .env
# Load .env variables
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

# يوقّع الـ session cookie
# يحميها من التعديل
app.secret_key = "supersecretkey"


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
            - Start with: Host greets listeners and says:
            "<HostName>: Welcome to another episode of '{{SHOW_TITLE}}'."
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
    # ---- Ensure the SHOW_TITLE placeholder is present in the intro ----
    PLACEHOLDER = SHOW_TITLE_PLACEHOLDER  # "{{SHOW_TITLE}}"

    # 1) Normalize common wrong variants the model might output
    if PLACEHOLDER not in raw_script:
        # {SHOW_TITLE}  →  {{SHOW_TITLE}}
        raw_script = re.sub(r"\{SHOW_TITLE\}", PLACEHOLDER, raw_script)
        # Bare SHOW_TITLE → {{SHOW_TITLE}}
        raw_script = re.sub(r"\bSHOW_TITLE\b", PLACEHOLDER, raw_script)

    # 2) English-style fallback: "episode of 'Some Name'"
    if PLACEHOLDER not in raw_script:
        m = re.search(
            r"(episode of\s+[\"“'«])(.+?)([\"”'»])",
            raw_script,
            flags=re.IGNORECASE,
        )
        if m:
            bad_title = m.group(2)
            raw_script = raw_script.replace(bad_title, PLACEHOLDER, 1)

    # 3) Arabic-style fallback: … حلقة جديدة من "اسم البودكاست"
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

    # ============================================================
    # 🔄 FINAL STEP: REBALANCE SPEAKERS
    # ============================================================
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
        # Original English behavior
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
    # Strip stray quotes if the model adds them
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

# ------------------------------------------------------------
# API endpoints for React (CreatePro, EditScript, Account)
# ------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify(status="ok")

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
            # Try preview_url or first sample
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
        displayName=data.get("name", "WeCast User"),  # your “username”
        handle=data.get("handle", "@wecast"),         # optional, can stay default
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

    # 1) Generate the script
    script = generate_podcast_script(description, speakers_info, script_style)

    # 2) Generate a short AI title for this episode
    title = generate_title_from_script(script, script_style)

    # 3) NEW: extract show title + turn script into a template
    script_template = script  # script already contains {{SHOW_TITLE}}
    show_title = title or "Podcast Show"


    # 4) Store everything in the session draft
    session["create_draft"] = {
        "script_style": script_style,
        "speakers_count": speakers,
        "speakers_info": speakers_info,
        "description": description,
        "script": script_template,
        "show_title": show_title,
        "title": title,
    }

    # 4) Return both script + title to the frontend
    return jsonify(ok=True, script=script_template, title=title, show_title=show_title)

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

        # Remove markdown headings (# Title)
        if line.startswith("#"):
            continue

        # Remove INTRO / BODY / OUTRO labels
        if re.fullmatch(r"(intro|body|outro)[:：]?\s*$", line, re.IGNORECASE):
            continue

        # Remove "Speaker: INTRO"
        if re.match(r"^([^:：]+)[:：]\s*(intro|body|outro)\s*$", line, re.IGNORECASE):
            continue

        # Remove standalone sound cue lines except [music]
        if re.fullmatch(r"\[[^\]]+\]", line):
            if line.lower() != "[music]":
                continue

        # Remove ANY inline tag like [laugh], [pause], [music], etc.
        line = re.sub(r"\[[^\]]*]", "", line)

        # Remove leftover unicode formatting characters
        line = re.sub(r"[\u200B-\u200D\uFEFF]", "", line)

        # Remove long separators like ---- or ••••
        if re.fullmatch(r"[-_=*~•·\u2022]{2,}", line):
            continue

        # Remove speaker labels ("ga: Hello" → "Hello")
        line = re.sub(r"^[A-Za-z0-9]{1,10}\s*[:：]\s*", "", line)

        # Remove accidental leftover beginning symbols
        line = re.sub(r"^[^\w]+", "", line)

        # Cleanup extra spaces
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

# هي أول خطوة أساسية قبل توليد الصوت.
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
# 3) نبدأ قراءة السكربت سطر سطر
    for raw in script.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue

        # Detect music cues
        if stripped.lower() == "[music]":
            segments.append(("__music__", None))
            continue

        # Detect "Speaker: text"
        if ":" in stripped:
            speaker, text = stripped.split(":", 1)
            speaker = speaker.strip()
            text = text.strip()

            if text:
                segments.append((speaker, text))
                last_speaker = speaker
            continue

        # Otherwise treat it as continuation of last speaker
        if last_speaker:
            segments.append((last_speaker, stripped))

    return segments

def synthesize_audio_from_script(script: str):
    """
    Core TTS logic.
    - If we have multiple distinct voices → multi-speaker generation.
    - Otherwise → single-voice fallback.
    Returns (ok: bool, result: url_or_error_message)
    """
    # 1) تنظيف السكربت والتأكد أنه غير فارغ
    music_index = 0
    script = (script or "").strip()
    if not script:
        return False, "Script is empty."
    # 2) تقسيم السكربت إلى أجزاء (متحدث + نص)
    segments = parse_script_into_segments(script)
    if not segments:
        return False, "Nothing to read after cleaning script."

# 3) بناء خريطة المتحدث →  Voice mapping voiceId
    speaker_to_voice, default_voice = build_speaker_voice_map()

    audio_parts = []   #  4) مصفوفة تخزين أجزاء الصوت

    for speaker, text in segments:

        if speaker.strip().lower() == "__music__":
            # Read user selections from session
            intro = session.get("introMusic", "")
            body = session.get("bodyMusic", "")
            outro = session.get("outroMusic", "")

            # Assign based on position of [music]
            if music_index == 0:
                selected_music = intro
            elif music_index in (1, 2):  # body tags
                selected_music = body
            else:
                selected_music = outro

            music_index += 1

            if selected_music:
                music_path = os.path.join("static", "music", selected_music)
                if os.path.exists(music_path):
                    music_clip = AudioSegment.from_mp3(music_path)
                    audio_parts.append(music_clip)

            continue



        # SPEECH SEGMENT

        if is_arabic(text):
            tts_text = text.strip()
        else:
            tts_text = clean_script_for_tts(text)

        if tts_text.strip():
            # اختيار الصوت المناسب للمتحدث:
            voice_id = speaker_to_voice.get(speaker, default_voice)
            tts_audio = b""

            # High-quality multilingual model for Arabic
            # طلب الصوت من ElevenLabs
            for chunk in voice_client.text_to_speech.convert(
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128",
                text=tts_text,
            ):
                if chunk:
                    tts_audio += chunk

            speech_segment = AudioSegment.from_file(BytesIO(tts_audio), format="mp3")
            audio_parts.append(speech_segment)


    # -----------------------------
    # COMBINE EVERYTHING CLEANLY (Merge) music and audio 
    # -----------------------------
    #  6) دمج كل شيء في ملف واحد
    if not audio_parts:
        return False, "No audio data generated."

    final_audio = AudioSegment.silent(duration=500)

    for item in audio_parts:
        final_audio += item

# 💾 7) تصدير الملف النهائي
    output_path = os.path.join("static", "output.mp3")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    final_audio.export(output_path, format="mp3")

    file_url = url_for("static", filename="output.mp3", _external=True)
    return True, file_url
     
@app.post("/api/audio")
def api_audio():
    """
    React endpoint – generate audio for the current script
    using per-speaker ElevenLabs voices.
    """
    payload = request.get_json(silent=True) or {}
    script = (payload.get("scriptText") or request.form.get("scriptText") or "").strip()

    ok, result = synthesize_audio_from_script(script)
    if not ok:
        # result is an error message
        return jsonify(error=result), 400

    # ✅ remember the last audio URL in session
    session["last_audio_url"] = result
    session.modified = True

    # result is the URL to output.mp3
    return jsonify(url=result)


@app.post("/api/save-music")
def save_music():
    data = request.get_json() or {}
    # Save intro/body/outro music filenames in session for later TTS merge
    session["introMusic"] = data.get("introMusic", "")
    session["bodyMusic"] = data.get("bodyMusic", "")
    session["outroMusic"] = data.get("outroMusic", "")

    return jsonify(ok=True)

# ------------------------------------------------------------
# ------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    # For React SPA
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

    # strong password rule from AC
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

    # same strong rule as signup
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
            # Update existing login timestamp + provider
            user_ref.update({
                "name": name,  # update name in case Google/Github provides fresh one
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
