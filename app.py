# app.py

from flask import (
    Flask,
    request,
    redirect,
    url_for,
    session,
    jsonify,
    Response,
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
from firebase_admin import firestore, storage
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone
import jwt
from firebase_init import db, get_storage_bucket
from PIL import Image, UnidentifiedImageError
import json

print("DEBUG in app.py:", db)

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
    print("âڑ ï¸ڈ ffmpeg_path missing or invalid")

if ffprobe_path and os.path.exists(ffprobe_path):
    AudioSegment.ffprobe = ffprobe_path
    ffprobe_dir = os.path.dirname(ffprobe_path)
    if ffprobe_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffprobe_dir + os.pathsep + os.environ.get("PATH", "")
else:
    print("âڑ ï¸ڈ ffprobe_path missing or invalid")

print("DEBUG AudioSegment.converter:", getattr(AudioSegment, "converter", None))
print("DEBUG AudioSegment.ffprobe:", getattr(AudioSegment, "ffprobe", None))
print("DEBUG PATH starts with:", os.environ["PATH"].split(os.pathsep)[0])


app.secret_key = app.config["SECRET_KEY"]
RECYCLE_BIN_RETENTION_DAYS = int(os.getenv("RECYCLE_BIN_RETENTION_DAYS", "30"))



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

def _chat_completion_with_fallback(messages, temperature=0.7, models=None):
    """
    Try multiple OpenAI chat models in order and return the first success.
    """
    model_candidates = models or [
        os.getenv("OPENAI_CHAT_MODEL", "").strip() or "gpt-4o",
        os.getenv("OPENAI_CHAT_FALLBACK_MODEL", "").strip() or "gpt-4o-mini",
    ]

    seen = set()
    ordered = []
    for m in model_candidates:
        if m and m not in seen:
            ordered.append(m)
            seen.add(m)

    errors = []
    for model in ordered:
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
            )
        except Exception as e:
            errors.append(f"{model}: {e}")

    raise RuntimeError(" | ".join(errors) if errors else "No OpenAI chat model configured")


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

def norm_token(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^\w\u0600-\u06FF]+", "", s)  # keep arabic letters too
    return s

def timeline_tokens(word_timeline):
    return [norm_token(w.get("w", "")) for w in word_timeline]

def find_anchor_start_sec(word_timeline, anchor: str):
    tokens = timeline_tokens(word_timeline)
    anchor_tokens = [norm_token(t) for t in anchor.split() if norm_token(t)]
    if len(anchor_tokens) < 2:
        return None

    n = len(tokens)
    m = len(anchor_tokens)

    for i in range(0, n - m + 1):
        if tokens[i:i+m] == anchor_tokens:
            return float(word_timeline[i]["start"])
    return None

def build_transcript_text_with_speakers(words):
    """
    Build a readable transcript with speaker labels in-line.
    Example:
      Bob: Hello there ...
      Alice: Hi Bob ...
    """
    if not words:
        return ""

    parts = []
    last_speaker = None

    for w in words:
        token = (w.get("w") or "").strip()
        if not token:
            continue

        speaker = (w.get("speaker") or "").strip()
        if speaker and speaker != last_speaker:
            if parts:
                parts.append("\n")
            parts.append(f"{speaker}: ")
            last_speaker = speaker

        parts.append(token + " ")

    return "".join(parts).strip()

def save_generated_podcast_to_firestore(user_id: str, title: str, script_style: str,
                                       description: str, script: str, speakers_info: list,
                                       language: str = ""):
    # 1) Create the podcast doc with an auto-ID
    podcast_ref = db.collection("podcasts").document()
    podcast_id = podcast_ref.id

    now = firestore.SERVER_TIMESTAMP
    lang = (language or "").strip().lower()
    if lang not in ("en", "ar"):
        lang = detect_language(description)

    # Podcast doc
    podcast_ref.set({
        "userId": user_id,
        "title": title or "Untitled Episode",
        "description": description,
        "language": lang,
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

def generate_podcast_script(description: str, speakers_info: list, script_style: str, language: str = ""):
    """Generate a structured podcast script where ALL speakers talk,
    and remove only headings and bracket lines without touching the real script content.
    """

    lang = (language or "").strip().lower()
    if lang not in ("en", "ar"):
        lang = detect_language(description)

    is_ar = lang == "ar"
    language_instruction = (
        "Please write the script in Arabic."
        if is_ar
        else "Please write the script in English."
    )

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
â€¢ Tone: Professional, journalistic.
â€¢ Flow: Host asks, guest answers.
â€¢ Turn-taking: MUST alternate speakers.
â€¢ Goal: Insightful conversation.
""",
        "Storytelling": """
â€¢ Tone: Cinematic and narrative.
â€¢ Flow: Story with emotional beats.
â€¢ Turn-taking: All speakers appear in intro, body, outro.
â€¢ Goal: Immersive storytelling.
""",
        "Educational": """
â€¢ Tone: Clear and helpful.
â€¢ Flow: Explain â†’ clarify â†’ examples.
â€¢ Turn-taking: Host + guests engage.
â€¢ Goal: Learn through dialogue.
""",
        "Conversational": """
â€¢ Tone: Friendly and natural.
â€¢ Flow: Co-host casual conversation.
â€¢ Turn-taking: Hosts react and alternate often.
â€¢ Goal: Feel like real conversation.
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

SPEAKER RULES (MANDATORY â€” DO NOT VIOLATE):
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
  â€¢ a reflective closing thought
  â€¢ a conversational wrap-up
  â€¢ a gentle shift phrase such as:
      "We'll continue right after this..."
      "More on that in a moment."
      "Let's pause for a second."

- The FIRST sentence after a [music] tag must feel like a fresh beginning or a smooth re-entry. 
- Use natural re-entry language like:
      "Welcome backâ€”"
      "Now letâ€™s continueâ€”"
      "Picking up where we left offâ€”"
      "So nowâ€”"

- DO NOT be robotic or repetitive. 
- Tone must feel intentional, confident, and designed for audio.

{language_instruction}

Transform the following text into a structured podcast script:

[TEXT START]
{description}
[TEXT END]
"""

    # ---- Call GPT ----
    response = _chat_completion_with_fallback(
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
            r"(episode of\s+[\"â€œ'آ«])(.+?)([\"â€‌'آ»])",
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
    # ًں§¹ CLEAN ONLY BAD LINES â€” DO NOT DELETE MAIN SCRIPT
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
    """Generate a short, catchy podcast episode title (4â€“8 words)."""

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

Write ONE short, catchy podcast episode title in 4â€“8 words.

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

    resp = _chat_completion_with_fallback(
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
    title = title.strip('"â€œâ€‌آ«آ»').strip()

    if not title:
        return "حلقة بدون عنوان" if is_ar else "Untitled Episode"

    return title


def fallback_time_split_chapters(word_timeline, language: str = "en"):
    if not word_timeline:
        return []

    duration = float(word_timeline[-1]["end"])
    # 5 chapters baseline
    cuts = [0.0, duration * 0.22, duration * 0.45, duration * 0.7, duration * 0.88]

    if language == "ar":
        titles = ["????????", "???????", "?????? ????????", "??????? ????", "???????"]
    else:
        titles = ["Opening", "Background", "Key Discussion", "Turning Points", "Wrap-Up"]
    out = [{"title": t, "startSec": float(c)} for t, c in zip(titles, cuts)]
    return out

def generate_chapters_from_transcript(transcript_text: str, language: str = "en"):
    # Keep prompt simple & strict JSON
    if language == "ar":
        user_prompt = f"""
Split this podcast transcript into podcast chapters for a player.
Return 5 to 7 chapters.
For each chapter:
- title: short (2-6 words) in Arabic.
- anchor: a short phrase (4-12 words) that appears in the transcript and starts that section (must be nearly exact text). Keep the anchor in the transcript's original language.

Return JSON only:
{{"chapters":[{{"title":"...","anchor":"..."}}, ...]}}

Transcript:
\"\"\"{transcript_text[:12000]}\"\"\"
"""
    else:
        user_prompt = f"""
Split this podcast transcript into podcast chapters for a player.
Return 5 to 7 chapters.
For each chapter:
- title: short (2â€“6 words)
- anchor: a short phrase (4â€“12 words) that appears in the transcript and starts that section (must be nearly exact text)

Return JSON only:
{{"chapters":[{{"title":"...","anchor":"..."}}, ...]}}

Transcript:
\"\"\"{transcript_text[:12000]}\"\"\"
"""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Return strict JSON only. No markdown."},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )

    raw = (resp.choices[0].message.content or "").strip()
    # naive JSON parse
    try:
        data = __import__("json").loads(raw)
        return data.get("chapters") or []
    except Exception:
        return []

def build_chapters(word_timeline, transcript_text, language="en"):
    proposed = generate_chapters_from_transcript(transcript_text, language=language)

    chapters = []
    used = set()

    for ch in proposed:
        title = (ch.get("title") or "").strip()
        anchor = (ch.get("anchor") or "").strip()
        if not title or not anchor:
            continue

        start = find_anchor_start_sec(word_timeline, anchor)
        if start is None:
            continue

        # avoid duplicates / too-close chapters
        key = round(start, 2)
        if key in used:
            continue
        used.add(key)

        chapters.append({"title": title, "startSec": start})

    chapters.sort(key=lambda x: x["startSec"])

    # Guardrails: must be â€œactual chaptersâ€‌
    # If fewer than 5 chapters, fallback to deterministic time split
    if len(chapters) < 5:
        chapters = fallback_time_split_chapters(word_timeline, language=language)

    return chapters


def validate_roles(style: str, speakers_info: list):
    roles = [s["role"] for s in speakers_info]

    if style == "Interview":
        return (
            roles in [["host", "guest"], ["host", "host", "guest"]],
            "For 'Interview' style, valid setups: 1 host â†’ 1 guest or 2 hosts â†’ 1 guest.",
        )

    if style == "Storytelling":
        return (
            roles in [["host"], ["host", "guest"], ["host", "guest", "guest"]],
            "For 'Storytelling' style, valid setups: 1 host solo, 1 host â†’ 1 guest, or 1 host â†’ 2 guests.",
        )

    if style == "Educational":
        return (
            roles in [["host"], ["host", "guest"], ["host", "guest", "guest"]],
            "For 'Educational' style, valid setups: 1 host solo, 1 host â†’ 1 guest, or 1 host â†’ 2 guests.",
        )

    if style == "Conversational":
        return (
            roles in [["host", "host"], ["host", "host", "host"]],
            "For 'Conversational', use 2â€“3 hosts (no guests).",
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

@app.get("/api/voices")
def api_voices():
    provider_q = (request.args.get("provider") or "").strip().lower()
    gender_q = (request.args.get("gender") or "").strip().lower()
    try:
        limit = int(request.args.get("limit") or "0")
    except Exception:
        limit = 0
    # Safety cap: allow larger lists but prevent overly heavy responses.
    limit = max(0, min(limit, 1000))

    def _gender_matches(value: str):
        if not gender_q:
            return True
        v = (value or "").strip().lower()
        if not v:
            return False
        return v == gender_q

    def _normalize_eleven_voice(v: dict):
        voice_id = v.get("voice_id") or v.get("voiceId") or v.get("id") or ""
        labels = v.get("labels") or {}
        gender = v.get("gender") or labels.get("gender") or ""
        return {
            "docId": voice_id,
            "id": voice_id,
            "providerVoiceId": voice_id,
            "provider": "ElevenLabs",
            "name": v.get("name") or "",
            "gender": gender,
            "description": v.get("description") or "",
            "pitch": labels.get("pitch") or "",
            "languages": labels.get("languages") or [],
            "tone": labels.get("tone") or [],
            "labels": {"gender": gender},
            "preview_url": v.get("preview_url") or "",
        }

    # If caller explicitly requests ElevenLabs, fetch live list directly.
    if provider_q == "elevenlabs":
        if not ELEVENLABS_API_KEY:
            return jsonify(count=0, items=[], error="Missing ELEVENLABS_API_KEY"), 500
        try:
            r = requests.get(
                "https://api.elevenlabs.io/v1/voices",
                headers={"xi-api-key": ELEVENLABS_API_KEY},
                timeout=30,
            )
            if not r.ok:
                return jsonify(
                    count=0,
                    items=[],
                    error=f"ElevenLabs voices error {r.status_code}: {r.text[:300]}",
                ), 502
            voices = (r.json() or {}).get("voices") or []
            items = [_normalize_eleven_voice(v) for v in voices if (v.get("voice_id") or v.get("id"))]
            if gender_q:
                items = [x for x in items if _gender_matches(x.get("gender"))]
            if limit > 0:
                items = items[:limit]
            return jsonify(count=len(items), items=items)
        except Exception as e:
            print("ElevenLabs /api/voices direct ERROR:", e)
            return jsonify(error=str(e), count=0, items=[]), 500

    try:
        docs = db.collection("voices").stream()

        items = []
        for d in docs:
            v = d.to_dict() or {}

            # normalize fields (support both Firestore styles)
            name = v.get("name") or v.get("Name") or ""
            gender = v.get("gender") or v.get("Gender") or ""
            description = v.get("description") or v.get("Description") or ""
            provider = v.get("provider") or v.get("Provider") or "ElevenLabs"
            pitch = v.get("pitch") or v.get("Pitch") or ""
            languages = v.get("languages") or v.get("Languages") or []
            tone = v.get("tone") or v.get("Tone") or []

            provider_voice_id = (
                v.get("providerVoiceId")
                or v.get("provider_voice_id")
                or v.get("voiceId")
                or v.get("VoiceId")
                or v.get("id")
                or d.id
            )

            out = {
                "docId": d.id,
                "id": provider_voice_id,           
                "providerVoiceId": provider_voice_id,    
                "provider": provider,
                "name": name,
                "gender": gender,
                "description": description,
                "pitch": pitch,
                "languages": languages if isinstance(languages, list) else [],
                "tone": tone if isinstance(tone, list) else [],
                "labels": {"gender": gender},  
                "preview_url": v.get("preview_url") or "",     
            }
            if _gender_matches(gender):
                items.append(out)

        if items:
            return jsonify(count=len(items), items=items)

        # Fallback to ElevenLabs if Firestore has no voices
        if not ELEVENLABS_API_KEY:
            return jsonify(count=0, items=[], error="Missing ELEVENLABS_API_KEY"), 500

        try:
            r = requests.get(
                "https://api.elevenlabs.io/v1/voices",
                headers={"xi-api-key": ELEVENLABS_API_KEY},
                timeout=30,
            )
            if not r.ok:
                return jsonify(
                    count=0,
                    items=[],
                    error=f"ElevenLabs voices error {r.status_code}: {r.text[:200]}",
                ), 502

            data = r.json() or {}
            voices = data.get("voices") or []
            for v in voices:
                voice_id = v.get("voice_id") or v.get("voiceId") or v.get("id") or ""
                labels = v.get("labels") or {}
                gender = v.get("gender") or labels.get("gender") or ""
                out = {
                    "docId": voice_id,
                    "id": voice_id,
                    "providerVoiceId": voice_id,
                    "provider": "ElevenLabs",
                    "name": v.get("name") or "",
                    "gender": gender,
                    "description": v.get("description") or "",
                    "pitch": labels.get("pitch") or "",
                    "languages": labels.get("languages") or [],
                    "tone": labels.get("tone") or [],
                    "labels": {"gender": gender},
                }
                if _gender_matches(gender):
                    items.append(out)

            return jsonify(count=len(items), items=items)
        except Exception as e:
            print("ElevenLabs /api/voices fallback ERROR:", e)
            return jsonify(error=str(e), count=0, items=[]), 500

    except Exception as e:
        print("Firestore /api/voices ERROR:", e)
        return jsonify(error=str(e), count=0, items=[]), 500

@app.post("/api/voices/preview")
def api_voice_preview():
    data = request.get_json(force=True) or {}
    incoming = (data.get("voiceId") or "").strip()
    incoming_name = (data.get("voiceName") or "").strip()
    text = (data.get("text") or "Hello, this is a WeCast preview.").strip()
    if len(text) > 120:
        text = text[:120].strip()

    if not ELEVENLABS_API_KEY:
        return jsonify(error="Missing ELEVENLABS_API_KEY"), 500

    if not incoming:
        return jsonify(error="Missing voiceId"), 400

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }

    def _synthesize_preview(candidate_voice_id: str):
        url = (
            f"https://api.elevenlabs.io/v1/text-to-speech/{candidate_voice_id}/stream"
            "?optimize_streaming_latency=4"
        )
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "output_format": "mp3_44100_64",
        }
        return requests.post(url, headers=headers, json=payload, timeout=40)

    # Fast path: synthesize directly using the incoming ID.
    voice_id = incoming
    r = _synthesize_preview(voice_id)
    if r.ok:
        return Response(r.content, mimetype="audio/mpeg")

    # Fallback: resolve by id/name from account voices, then retry once.
    if r.status_code == 404:
        try:
            vr = requests.get(
                "https://api.elevenlabs.io/v1/voices",
                headers={"xi-api-key": ELEVENLABS_API_KEY},
                timeout=20,
            )
            if not vr.ok:
                return jsonify(
                    error=f"ElevenLabs voices list failed {vr.status_code}",
                    details=vr.text[:400],
                ), 502

            voices = (vr.json() or {}).get("voices") or []
            by_id = {str(v.get("voice_id") or v.get("id") or "").strip(): v for v in voices}
            by_name = {
                (v.get("name") or "").strip().lower(): v
                for v in voices
                if (v.get("name") or "").strip()
            }

            if voice_id not in by_id:
                suggest_name = (incoming_name or incoming).strip().lower()
                match = by_name.get(suggest_name)
                if match and (match.get("voice_id") or match.get("id")):
                    voice_id = (match.get("voice_id") or match.get("id")).strip()
                else:
                    return jsonify(
                        error="Voice not found in ElevenLabs account",
                        received=incoming,
                        receivedName=incoming_name,
                    ), 404

            retry = _synthesize_preview(voice_id)
            if retry.ok:
                return Response(retry.content, mimetype="audio/mpeg")
            if retry.status_code == 404:
                return jsonify(
                    error="Voice not found on ElevenLabs",
                    voice_id=voice_id,
                    details=retry.text[:400],
                ), 404
            return jsonify(
                error=f"ElevenLabs error {retry.status_code}",
                voice_id=voice_id,
                details=retry.text[:800],
            ), 502
        except Exception as e:
            return jsonify(error="Failed to resolve voice", details=str(e)), 500

    return jsonify(
        error=f"ElevenLabs error {r.status_code}",
        voice_id=voice_id,
        details=r.text[:800],
    ), 502

def _require_login_user():
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return None, (jsonify(error="Not logged in"), 401)
    return user_id, None


def _assert_podcast_owner(podcast_id: str, user_id: str):
    ref = db.collection("podcasts").document(podcast_id)
    doc = ref.get()
    if not doc.exists:
        return None, (jsonify(error="Podcast not found"), 404)

    pdata = doc.to_dict() or {}
    if pdata.get("userId") != user_id:
        return None, (jsonify(error="Forbidden"), 403)

    return pdata, None


def _get_draft_for(podcast_id: str):
    draft = session.get("create_draft") or {}
    # Safety: only return the draft if it matches the podcastId
    if draft.get("podcastId") != podcast_id:
        return {}
    return draft


def _set_draft_for(podcast_id: str, updates: dict):
    draft = session.get("create_draft") or {}
    if draft.get("podcastId") != podcast_id:
        # If the draft isn't for this podcast, create a minimal draft entry
        draft = {"podcastId": podcast_id}
    draft.update(updates)
    session["create_draft"] = draft
    session.modified = True


def _validate_image_bytes(image_bytes: bytes, min_size: int = 512):
    try:
        img = Image.open(BytesIO(image_bytes))
        img.verify()  # verify file integrity
    except UnidentifiedImageError:
        return False, "Unsupported image format. Please upload PNG/JPG."
    except Exception:
        return False, "Invalid image file."

    # reopen after verify
    img = Image.open(BytesIO(image_bytes))
    w, h = img.size

    if w < min_size or h < min_size:
        return False, f"Image too small. Minimum is {min_size}x{min_size}px."

    # We wonâ€™t force square (can crop on frontend). But you can enforce if you want:
    # if w != h: return False, "Please upload a square image (1:1)."

    return True, {"width": w, "height": h, "format": (img.format or "").upper()}


def _build_cover_prompt(title: str, style: str, language: str, description: str, extra: str = ""):
    lang_hint = "Arabic" if language == "ar" else "English"

    # IMPORTANT: no text on image (title is shown in UI, not baked into art)
    return f"""
Create a professional podcast cover art image.

Context:
- Episode title: "{title}"
- Podcast style: {style or "Conversational"}
- Language context: {lang_hint}

Design requirements:
- Square composition (1:1), podcast-platform friendly
- Modern, clean, high contrast, minimal clutter
- A single strong focal concept + abstract shapes related to the topic
- Do NOT include readable text, letters, numbers, logos, or watermarks
- Avoid photorealistic faces; prefer abstract/illustrative/graphic styles

Topic description:
{description[:1200]}

Optional direction:
{extra}
""".strip()


def _generate_cover_b64(prompt: str, size: str = "1024x1024") -> str:
    """
    Uses OpenAI Images API (gpt-image-1) and returns base64 PNG.
    """
    img = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=size,
    )
    return img.data[0].b64_json


def _cover_ext_from_mime(mime_type: str) -> str:
    mt = (mime_type or "").lower()
    if mt == "image/jpeg":
        return "jpg"
    if mt == "image/webp":
        return "webp"
    return "png"


def _make_cover_thumb_b64(image_bytes: bytes, size: int = 256) -> str:
    """
    Create a small JPEG thumbnail base64 suitable for Firestore storage.
    """
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((size, size))
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=78, optimize=True)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        return ""


def _persist_cover_to_storage_and_doc(podcast_id: str, cover_b64: str, mime_type: str = "image/png"):
    """
    Persist cover image to Firebase Storage when possible, and always store
    a compact DB thumbnail fallback (coverThumbB64) for Episodes cards.
    Returns: (cover_url, storage_path, thumb_b64, persist_error)
    """
    if not cover_b64:
        return "", "", "", "missing_cover_data"

    img_bytes = base64.b64decode(cover_b64)
    thumb_b64 = _make_cover_thumb_b64(img_bytes)
    ext = _cover_ext_from_mime(mime_type)
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    storage_path = f"covers/{podcast_id}/{ts}.{ext}"

    bucket = get_storage_bucket()
    bucket_name = (getattr(bucket, "name", "") or "").strip()
    candidates = [bucket_name] if bucket_name else []
    if bucket_name.endswith(".appspot.com"):
        candidates.append(bucket_name.replace(".appspot.com", ".firebasestorage.app"))
    elif bucket_name.endswith(".firebasestorage.app"):
        candidates.append(bucket_name.replace(".firebasestorage.app", ".appspot.com"))

    last_err = None
    cover_url = ""
    used_bucket = ""
    for bname in [x for x in candidates if x]:
        try:
            b = storage.bucket(bname)
            blob = b.blob(storage_path)
            blob.upload_from_string(img_bytes, content_type=mime_type)
            # Signed URL (long-lived) avoids ACL/public-bucket requirements.
            cover_url = blob.generate_signed_url(
                expiration=timedelta(days=3650),
                method="GET",
            )
            used_bucket = bname
            break
        except Exception as e:
            last_err = e

    db.collection("podcasts").document(podcast_id).set(
        {
            "coverUrl": cover_url,
            "coverPath": storage_path,
            "coverMimeType": mime_type,
            "coverBucket": used_bucket,
            "coverThumbB64": thumb_b64,
            "coverUpdatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )

    persist_error = ""
    if not cover_url:
        persist_error = f"storage_upload_failed buckets={candidates} last_error={last_err}"

    return cover_url, storage_path, thumb_b64, persist_error

@app.get("/api/podcasts/<podcast_id>/finalize")
def api_finalize_get(podcast_id):
    user_id, err = _require_login_user()
    if err:
        return err

    pdata, err = _assert_podcast_owner(podcast_id, user_id)
    if err:
        return err

    draft = _get_draft_for(podcast_id)
    cover_b64 = draft.get("coverArtBase64")
    cover_meta = draft.get("coverArtMeta") or {}
    title = draft.get("title") or pdata.get("title") or "Untitled Episode"

    return jsonify(
        ok=True,
        podcastId=podcast_id,
        title=title,
        coverArtBase64=cover_b64,
        coverArtMeta=cover_meta,
    )

@app.post("/api/podcasts/<podcast_id>/cover/generate")
def api_cover_generate(podcast_id):
    user_id, err = _require_login_user()
    if err:
        return err

    pdata, err = _assert_podcast_owner(podcast_id, user_id)
    if err:
        return err

    payload = request.get_json(silent=True) or {}

    # prefer the latest title (payload -> session draft -> firestore)
    draft = _get_draft_for(podcast_id)
    title = (payload.get("title") or draft.get("title") or pdata.get("title") or "Untitled Episode").strip()

    # topic text: prefer session description, otherwise fetch from Firestore script
    description = (payload.get("description") or draft.get("description") or "").strip()
    if not description:
        try:
            sdoc = db.collection("podcasts").document(podcast_id).collection("scripts").document("main").get()
            if sdoc.exists:
                sdata = sdoc.to_dict() or {}
                description = (sdata.get("sourceText") or sdata.get("finalScriptText") or "")[:2000]
        except Exception:
            description = ""

    style = (payload.get("style") or draft.get("script_style") or pdata.get("style") or "Conversational").strip()
    language = (payload.get("language") or draft.get("language") or pdata.get("language") or "en").strip().lower()
    extra = (payload.get("direction") or "").strip()  # optional: "blue palette", "minimal", etc.

    prompt = _build_cover_prompt(title=title, style=style, language=language, description=description, extra=extra)

    try:
        b64 = _generate_cover_b64(prompt, size="1024x1024")
    except Exception as e:
        print("Cover generation error:", e)
        return jsonify(error=f"Failed to generate cover art: {str(e)}"), 500

    try:
        cover_url, storage_path, thumb_b64, persist_error = _persist_cover_to_storage_and_doc(
            podcast_id, b64, "image/png"
        )
    except Exception as e:
        print("Cover persist error:", e)
        return jsonify(error="Cover generated but failed to persist."), 500

    # Keep session draft for immediate preview/finalize UI state.
    _set_draft_for(podcast_id, {
        "coverArtBase64": b64,
        "coverArtMeta": {
            "generatedAt": datetime.utcnow().isoformat(),
            "source": "openai",
            "mimeType": "image/png",
            "storagePath": storage_path,
            "coverUrl": cover_url,
            "persistError": persist_error,
        },
        "title": title,  # keep title synced for step 7
    })

    return jsonify(
        ok=True,
        podcastId=podcast_id,
        coverArtBase64=b64,
        coverUrl=cover_url,
        coverThumbB64=thumb_b64,
        warning=("Cover thumbnail saved; storage URL unavailable." if persist_error else ""),
    )

@app.post("/api/podcast/<podcast_id>/update")
def api_update_podcast(podcast_id):
    """Save all changes to podcast (script, speakers, music)"""
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    data = request.get_json(silent=True) or {}
    print(f"Received update for podcast {podcast_id}")
    print(f"Data keys: {data.keys()}")
    
    # Get podcast document
    podcast_ref = db.collection("podcasts").document(podcast_id)
    podcast_doc = podcast_ref.get()
    
    if not podcast_doc.exists:
        return jsonify(error="Podcast not found"), 404

    podcast_data = podcast_doc.to_dict() or {}
    
    # Verify ownership
    if podcast_data.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    # Update main podcast document
    updates = {
        "title": data.get("showTitle", podcast_data.get("title", "")),
        "lastEditedAt": firestore.SERVER_TIMESTAMP,
    }
    
    if data.get("description"):
        updates["description"] = data.get("description")
    
    if data.get("category"):
        updates["category"] = data.get("category")
        session["category"] = data.get("category")
    
    podcast_ref.set(updates, merge=True)
    print(f"Updated main podcast document")

    # IMPORTANT: Get the script that the frontend sent (already has updated speaker names)
    script_to_save = data.get("script", "")
    print(f"DEBUG: Saving script with length: {len(script_to_save)}")
    print(f"DEBUG: Script preview: {script_to_save[:200]}")
    
    # Update script - the frontend has already updated the speaker names
    if script_to_save:
        script_ref = podcast_ref.collection("scripts").document("main")
        script_ref.set({
            "finalScriptText": script_to_save,
            "wordCount": len((script_to_save or "").split()),
            "lastEditedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        print(f"DEBUG: Script saved to Firestore")
    else:
        print(f"DEBUG: No script to save")

    # Update speakers - delete old ones and add new ones
    if data.get("speakers"):
        print(f"DEBUG: Saving {len(data.get('speakers'))} speakers")
        
        # Delete existing speakers
        for speaker_doc in podcast_ref.collection("speakers").stream():
            speaker_doc.reference.delete()
        
        # Add new speakers
        for speaker in data.get("speakers", []):
            podcast_ref.collection("speakers").document().set({
                "name": speaker.get("name", ""),
                "gender": speaker.get("gender", "Male"),
                "role": speaker.get("role", "host"),
                "providerVoiceId": speaker.get("voiceId", ""),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            })
        print(f"DEBUG: Speakers saved")

    # Save music selections to session
    if data.get("introMusic") is not None:
        session["introMusic"] = data.get("introMusic")
    if data.get("bodyMusic") is not None:
        session["bodyMusic"] = data.get("bodyMusic")
    if data.get("outroMusic") is not None:
        session["outroMusic"] = data.get("outroMusic")
    
    session.modified = True

    return jsonify({
        "ok": True,
        "message": "Podcast updated successfully",
        "podcastId": podcast_id,
        "updatedScript": script_to_save  # Return the updated script to frontend
    })

@app.post("/api/podcasts/<podcast_id>/cover/upload")
def api_cover_upload(podcast_id):
    user_id, err = _require_login_user()
    if err:
        return err

    _, err = _assert_podcast_owner(podcast_id, user_id)
    if err:
        return err

    if "file" not in request.files:
        return jsonify(error="Missing file"), 400

    f = request.files["file"]
    image_bytes = f.read()
    if not image_bytes:
        return jsonify(error="Empty file"), 400

    ok, info = _validate_image_bytes(image_bytes, min_size=512)
    if not ok:
        return jsonify(error=info), 400

    mimeType = "image/png" if info["format"] == "PNG" else "image/jpeg"

    # Encode to base64 for session storage + frontend display
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        cover_url, storage_path, thumb_b64, persist_error = _persist_cover_to_storage_and_doc(
            podcast_id, b64, mimeType
        )
    except Exception as e:
        print("Cover persist error:", e)
        return jsonify(error="Cover uploaded but failed to persist."), 500

    _set_draft_for(podcast_id, {
        "coverArtBase64": b64,
        "coverArtMeta": {
            "uploadedAt": datetime.utcnow().isoformat(),
            "source": "upload",
            "width": info["width"],
            "height": info["height"],
            "format": info["format"],
            "mimeType": mimeType,
            "storagePath": storage_path,
            "coverUrl": cover_url,
            "persistError": persist_error,
        },
    })

    return jsonify(
        ok=True,
        podcastId=podcast_id,
        coverArtBase64=b64,
        coverUrl=cover_url,
        coverThumbB64=thumb_b64,
        mimeType=mimeType,
        meta=info,
        warning=("Cover thumbnail saved; storage URL unavailable." if persist_error else ""),
    )

@app.post("/api/podcasts/<podcast_id>/title")
def api_podcast_update_title(podcast_id):
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    ref = db.collection("podcasts").document(podcast_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify(error="Podcast not found"), 404

    pdata = doc.to_dict() or {}
    if pdata.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    if not title:
        return jsonify(error="Title is required"), 400

    ref.set(
        {"title": title, "lastEditedAt": firestore.SERVER_TIMESTAMP},
        merge=True
    )

    # also keep session draft in sync if itâ€™s the same podcast
    draft = session.get("create_draft") or {}
    if draft.get("podcastId") == podcast_id:
        draft["title"] = title
        draft["show_title"] = title
        session["create_draft"] = draft
        session.modified = True

    return jsonify(ok=True, podcastId=podcast_id, title=title)

@app.post("/api/podcasts/<podcast_id>/cover/clear")
def api_cover_clear(podcast_id):
    user_id, err = _require_login_user()
    if err:
        return err

    _, err = _assert_podcast_owner(podcast_id, user_id)
    if err:
        return err

    try:
        pdata, _ = _assert_podcast_owner(podcast_id, user_id)
        old_path = (pdata or {}).get("coverPath") or ""
        if old_path:
            bucket = get_storage_bucket()
            blob = bucket.blob(old_path)
            if blob.exists():
                blob.delete()
    except Exception as e:
        print("Cover delete warning:", e)

    db.collection("podcasts").document(podcast_id).set(
        {
            "coverUrl": "",
            "coverPath": "",
            "coverMimeType": "",
            "coverThumbB64": "",
            "coverUpdatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )

    _set_draft_for(podcast_id, {"coverArtBase64": None, "coverArtMeta": {}})
    return jsonify(ok=True)

@app.get("/api/me")
def api_me():
    """
    Return the logged-in user's basic profile from Firestore.
    Uses the session user_id set during /api/login or /api/social-login.
    """
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    try:
        user_ref = db.collection("users").document(user_id)
        doc = user_ref.get()

        if not doc.exists:
            return jsonify(error="User not found"), 404

        data = doc.to_dict() or {}

        return jsonify(
            email=data.get("email", user_id),
            displayName=data.get("name", data.get("displayName", "WeCast User")),
            bio=data.get("bio", "I create AI-powered podcasts."),
            avatarUrl=data.get("avatarUrl", ""),
            handle=data.get("handle", f"@{data.get('name', 'user').lower().replace(' ', '')}"),
            createdAt=data.get("created_at"),
        )
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return jsonify(error="Failed to fetch profile"), 500


@app.post("/api/profile/update")
def api_profile_update():
    """Update user profile information"""
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    # Handle form data with possible file upload
    if request.content_type and 'multipart/form-data' in request.content_type:
        display_name = request.form.get('displayName', '').strip()
        bio = request.form.get('bio', '').strip()
        
        # Handle avatar upload
        avatar_file = request.files.get('avatar')
        avatar_url = None
        
        if avatar_file and avatar_file.filename:
            # Validate file type
            if not avatar_file.content_type.startswith('image/'):
                return jsonify(error="Only image files are allowed"), 400
            
            # Read file bytes
            image_bytes = avatar_file.read()
            
            # Validate image size (max 5MB)
            if len(image_bytes) > 5 * 1024 * 1024:
                return jsonify(error="Image size should be less than 5MB"), 400
            
            try:
                # Upload to Firebase Storage
                bucket = get_storage_bucket()
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                # Sanitize filename
                safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '', avatar_file.filename)
                filename = f"avatars/{user_id}/{timestamp}_{safe_filename}"
                blob = bucket.blob(filename)
                
                # Set content type
                blob.upload_from_string(
                    image_bytes, 
                    content_type=avatar_file.content_type
                )
                
                # Make publicly accessible
                blob.make_public()
                avatar_url = blob.public_url
                
            except Exception as e:
                print(f"Avatar upload error: {e}")
                return jsonify(error="Failed to upload avatar"), 500
    else:
        # JSON data (if no file upload)
        data = request.get_json(silent=True) or {}
        display_name = data.get('displayName', '').strip()
        bio = data.get('bio', '').strip()
        avatar_url = data.get('avatarUrl', '').strip()

    # Prepare update data
    update_data = {}
    
    if display_name:
        update_data['name'] = display_name
        update_data['displayName'] = display_name
        # Auto-generate handle from display name
        handle = f"@{display_name.lower().replace(' ', '')}"
        update_data['handle'] = handle
    
    if bio is not None:  # Allow empty bio
        update_data['bio'] = bio
    
    if avatar_url:
        update_data['avatarUrl'] = avatar_url
    
    update_data['updatedAt'] = firestore.SERVER_TIMESTAMP

    if not update_data:
        return jsonify(error="No data to update"), 400

    try:
        # Update Firestore
        user_ref = db.collection("users").document(user_id)
        user_ref.set(update_data, merge=True)
        
        # Get updated user data
        updated_doc = user_ref.get()
        updated_data = updated_doc.to_dict() or {}
        
        return jsonify({
            "ok": True,
            "message": "Profile updated successfully",
            "displayName": updated_data.get('name', updated_data.get('displayName', '')),
            "bio": updated_data.get('bio', ''),
            "avatarUrl": updated_data.get('avatarUrl', ''),
            "email": updated_data.get('email', ''),
            "handle": updated_data.get('handle', '')
        })
        
    except Exception as e:
        print(f"Profile update error: {e}")
        return jsonify(error="Failed to update profile"), 500

@app.get("/api/podcast/<podcast_id>")
def api_get_podcast(podcast_id):
    """Fetch full podcast data for editing"""
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    # Get podcast document
    podcast_ref = db.collection("podcasts").document(podcast_id)
    podcast_doc = podcast_ref.get()
    
    if not podcast_doc.exists:
        return jsonify(error="Podcast not found"), 404

    podcast_data = podcast_doc.to_dict() or {}
    
    # Verify ownership
    if podcast_data.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    # Get speakers from subcollection
    speakers = []
    speakers_query = podcast_ref.collection("speakers").stream()
    for speaker_doc in speakers_query:
        speaker_data = speaker_doc.to_dict() or {}
        speakers.append({
            "name": speaker_data.get("name", ""),
            "gender": speaker_data.get("gender", "Male"),
            "role": speaker_data.get("role", "host"),
            "voiceId": speaker_data.get("providerVoiceId", ""),
        })

    # Get script from subcollection
    script_doc = podcast_ref.collection("scripts").document("main").get()
    script = ""
    script_template = ""
    if script_doc.exists:
        script_data = script_doc.to_dict() or {}
        script = script_data.get("finalScriptText", "")
        script_template = script_data.get("sourceText", "")

    # Return all data the edit page needs
    return jsonify({
        "id": podcast_id,
        "script": script,
        "scriptTemplate": script_template,
        "showTitle": podcast_data.get("title", ""),
        "title": podcast_data.get("title", ""),
        "episodeTitle": podcast_data.get("title", ""),
        "scriptStyle": podcast_data.get("style", ""),
        "speakersCount": len(speakers),
        "speakers": speakers,
        "description": podcast_data.get("description", ""),
        "introMusic": session.get("introMusic", ""),
        "bodyMusic": session.get("bodyMusic", ""),
        "outroMusic": session.get("outroMusic", ""),
        "category": session.get("category", ""),
        "language": podcast_data.get("language", "en"),
    })
    
@app.post("/api/generate")
def api_generate():
    data = request.get_json(force=True)
    script_style = (data.get("script_style") or "").strip()
    speakers = int(data.get("speakers") or 0)
    speakers_info = data.get("speakers_info") or []
    description = (data.get("description") or "").strip()
    ui_language = (data.get("language") or "").strip().lower()

    ok, msg = validate_roles(script_style, speakers_info)
    if not ok:
        return jsonify(ok=False, error=msg), 400
    if not script_style:
        return jsonify(ok=False, error="Please choose a podcast style."), 400
    if speakers not in (1, 2, 3):
        return jsonify(ok=False, error="Invalid speakers count."), 400
    if len(description.split()) < 500:
        return jsonify(ok=False, error="Your text must be at least 500 words."), 400

    try:
        script = generate_podcast_script(description, speakers_info, script_style, language=ui_language)
    except Exception as e:
        print("api_generate script error:", e)
        return jsonify(ok=False, error=f"Script generation failed: {str(e)}"), 500

    try:
        title = generate_title_from_script(script, script_style)
    except Exception as e:
        print("api_generate title error:", e)
        title = "Podcast Show"

    script_template = script  
    show_title = title or "Podcast Show"
    # âœ… figure out user (prefer session)
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
        language=ui_language,
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




@app.get("/api/episodes")
def api_episodes_list():
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    def _clean_for_brief(text: str):
        if not text:
            return ""
        lines = []
        for raw_line in str(text).replace("\r", "\n").split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            # Ignore section headers and stage directions.
            if re.match(r"^(INTRO|BODY|OUTRO)\s*:?$", line, re.IGNORECASE):
                continue
            if re.match(r"^[\[\(].*[\]\)]$", line):
                continue

            # Convert "Speaker: text" to just "text" for a clean synopsis.
            m = re.match(r"^[^:]{1,40}:\s+(.+)$", line)
            if m:
                line = m.group(1).strip()
            lines.append(line)

        return " ".join(lines)

    def _short_brief(text: str, limit: int = 220):
        raw = " ".join((_clean_for_brief(text) or "").split())
        if not raw:
            return ""
        if len(raw) <= limit:
            return raw

        cutoff = raw[:limit]
        punct_idx = max(cutoff.rfind("."), cutoff.rfind("!"), cutoff.rfind("?"))
        if punct_idx >= 80:
            return cutoff[: punct_idx + 1].rstrip()
        return cutoff.rstrip() + "..."

    def _has_arabic(text: str):
        return bool(re.search(r"[\u0600-\u06FF]", text or ""))

    def _choose_best_brief(candidates, prefer_arabic: bool):
        usable = [c for c in candidates if (c or "").strip()]
        if not usable:
            return ""
        if not prefer_arabic:
            return usable[0]
        for candidate in usable:
            if _has_arabic(candidate):
                return candidate
        return usable[0]

    def _coerce_datetime(value):
        if isinstance(value, datetime):
            return value
        to_datetime = getattr(value, "to_datetime", None)
        if callable(to_datetime):
            try:
                return to_datetime()
            except Exception:
                return None
        return None

    def _purge_episode_document(ref):
        for sub_name in ("scripts", "speakers", "transcripts"):
            try:
                for sub_doc in ref.collection(sub_name).stream():
                    sub_doc.reference.delete()
            except Exception:
                pass
        ref.delete()

    query = db.collection("podcasts").where("userId", "==", user_id)
    now_utc = datetime.now(timezone.utc)
    recycle_cutoff = now_utc - timedelta(days=RECYCLE_BIN_RETENTION_DAYS)
    items = []
    recycle_items = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        deleted_at = _coerce_datetime(data.get("deletedAt"))
        if deleted_at and deleted_at.tzinfo is None:
            deleted_at = deleted_at.replace(tzinfo=timezone.utc)
        if deleted_at and deleted_at <= recycle_cutoff:
            _purge_episode_document(doc.reference)
            continue

        # Show only finalized/saved episodes.
        # Legacy compatibility: older saved episodes may still carry status="draft"
        # from historical flows, so we treat rich, finalized-looking records as saved.
        status = str(data.get("status") or "").strip().lower()
        if status == "deleted" and deleted_at:
            is_saved = True
            legacy_saved = False
        else:
            is_saved = status == "saved" or bool(data.get("savedAt"))
            legacy_saved = (
                status == "draft"
                and bool(data.get("audioUrl"))
                and bool(data.get("summary"))
                and isinstance(data.get("chapters"), list)
                and len(data.get("chapters")) > 0
            )
        if not (is_saved or legacy_saved):
            continue

        script_source = ""
        script_final = ""
        script_doc = (
            db.collection("podcasts")
            .document(doc.id)
            .collection("scripts")
            .document("main")
            .get()
        )
        if script_doc.exists:
            sdata = script_doc.to_dict() or {}
            script_source = sdata.get("sourceText") or ""
            script_final = sdata.get("finalScriptText") or ""

        title = data.get("title") or ""
        prefer_arabic_brief = _has_arabic(title) or (data.get("language") == "ar")
        # Keep brief episode-specific first, and prefer Arabic text for Arabic episodes.
        brief = _choose_best_brief(
            [
                data.get("summary") or "",
                data.get("transcriptText") or "",
                script_final,
                script_source,
                data.get("description") or "",
            ],
            prefer_arabic=prefer_arabic_brief,
        )

        payload = {
            "id": doc.id,
            "title": title or "Untitled Episode",
            "brief": _short_brief(brief),
            "audioUrl": data.get("audioUrl") or "",
            "style": data.get("style") or "",
            "scriptStyle": data.get("style") or "",
            "coverUrl": data.get("coverUrl") or "",
            "coverThumbB64": data.get("coverThumbB64") or "",
            "createdAt": data.get("createdAt"),
        }

        if deleted_at:
            payload["deletedAt"] = deleted_at.isoformat()
            payload["deleteAfter"] = (
                deleted_at + timedelta(days=RECYCLE_BIN_RETENTION_DAYS)
            ).isoformat()
            recycle_items.append(payload)
        else:
            items.append(payload)

    return jsonify(
        items=items,
        recycleBin=recycle_items,
        retentionDays=RECYCLE_BIN_RETENTION_DAYS,
    )


@app.post("/api/episodes/<episode_id>/trash")
def api_trash_episode(episode_id):
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    ref = db.collection("podcasts").document(episode_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify(error="Episode not found"), 404

    data = doc.to_dict() or {}
    if data.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    current_status = str(data.get("status") or "").strip() or "saved"
    deleted_at = datetime.now(timezone.utc)
    ref.set(
        {
            "status": "deleted",
            "deletedAt": deleted_at,
            "deletedBy": user_id,
            "deletedFromStatus": current_status,
        },
        merge=True,
    )

    return jsonify(ok=True, trashedId=episode_id, deletedAt=deleted_at.isoformat())


@app.post("/api/episodes/<episode_id>/restore")
def api_restore_episode(episode_id):
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    ref = db.collection("podcasts").document(episode_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify(error="Episode not found"), 404

    data = doc.to_dict() or {}
    if data.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    fallback_status = "saved" if data.get("savedAt") else "draft"
    restored_status = str(data.get("deletedFromStatus") or "").strip() or fallback_status
    if restored_status == "deleted":
        restored_status = fallback_status

    ref.update(
        {
            "status": restored_status,
            "deletedAt": firestore.DELETE_FIELD,
            "deletedBy": firestore.DELETE_FIELD,
            "deletedFromStatus": firestore.DELETE_FIELD,
        }
    )

    return jsonify(ok=True, restoredId=episode_id)


@app.post("/api/episodes/<episode_id>/delete")
def api_delete_episode(episode_id):
    user_id = session.get("user_id") or get_current_user_email()
    if not user_id:
        return jsonify(error="Not logged in"), 401

    ref = db.collection("podcasts").document(episode_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify(error="Episode not found"), 404

    data = doc.to_dict() or {}
    if data.get("userId") != user_id:
        return jsonify(error="Forbidden"), 403

    # Delete known subcollections first so DB and UI stay consistent.
    for sub_name in ("scripts", "speakers", "transcripts"):
        try:
            for sub_doc in ref.collection(sub_name).stream():
                sub_doc.reference.delete()
        except Exception:
            pass

    ref.delete()

    return jsonify(ok=True, deletedId=episode_id)






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

        if re.fullmatch(r"(intro|body|outro)[:ï¼ڑ]?\s*$", line, re.IGNORECASE):
            continue

        if re.match(r"^([^:ï¼ڑ]+)[:ï¼ڑ]\s*(intro|body|outro)\s*$", line, re.IGNORECASE):
            continue

        if re.fullmatch(r"\[[^\]]+\]", line):
            if line.lower() != "[music]":
                continue

        line = re.sub(r"\[[^\]]*]", "", line)

        line = re.sub(r"[\u200B-\u200D\uFEFF]", "", line)

        if re.fullmatch(r"[-_=*~â€¢آ·\u2022]{2,}", line):
            continue

        line = re.sub(r"^[A-Za-z0-9]{1,10}\s*[:ï¼ڑ]\s*", "", line)

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

def synthesize_audio_from_script(script: str, podcast_id: str = ""):
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
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "", podcast_id or "")
    if not safe_id:
        safe_id = "output"
    filename = f"output_{safe_id}.mp3"
    output_path = os.path.join("static", filename)

    final_audio.export(output_path, format="mp3")

    file_url = url_for("static", filename=filename, _external=True)

    # store last transcript in session too (optional but useful)
    session["last_word_timeline"] = word_timeline
    session.modified = True

    return True, {"url": file_url, "words": word_timeline}

@app.post("/api/audio")
def api_audio():
    
    payload = request.get_json(silent=True) or {}
    script = (payload.get("scriptText") or request.form.get("scriptText") or "").strip()
    podcast_id = (payload.get("podcastId") or "").strip()
    ui_language = (payload.get("language") or "").strip().lower()

    print("DEBUG /api/audio script length:", len(script))
    print("DEBUG /api/audio first 200 chars:", script[:200])
    print("DEBUG /api/audio podcastId:", podcast_id)
    incoming_speakers_info = payload.get("speakers_info")
    if isinstance(incoming_speakers_info, list) and incoming_speakers_info:
        draft = session.get("create_draft") or {}
        draft["speakers_info"] = incoming_speakers_info
        session["create_draft"] = draft
        session.modified = True

    if not podcast_id:
        return jsonify(error="Missing podcastId"), 400

    ok, result = synthesize_audio_from_script(script, podcast_id)
    if not ok:
        return jsonify(error=result), 400

    # keep audio in session (as you want)
    session["last_audio_url"] = result["url"]
    session.modified = True

    # âœ… NEW: save live transcript (word timeline) to Firestore
    user_id = session.get("user_id") or get_current_user_email()
    if user_id and podcast_id:
        podcast_ref = db.collection("podcasts").document(podcast_id)
        doc = podcast_ref.get()

        if doc.exists:
            pdata = doc.to_dict() or {}
            if pdata.get("userId") == user_id:
                words = result.get("words") or []
                transcript_text = build_transcript_text_with_speakers(words)

                if ui_language in ("en", "ar"):
                    podcast_ref.set({
                        "language": ui_language,
                    }, merge=True)

                # Save transcript text in main podcast doc (small)
                podcast_ref.set({
                    "transcriptText": transcript_text,
                    "transcriptUpdatedAt": firestore.SERVER_TIMESTAMP,
                    "audioUrl": result["url"],
                    "audioUpdatedAt": firestore.SERVER_TIMESTAMP,
                }, merge=True)

                # Save full word timeline in a subcollection doc
                podcast_ref.collection("transcripts").document("main").set({
                    "words": words,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                }, merge=True)
                
                # Generate & save chapters
                language = ui_language or pdata.get("language") or "en"
                chapters = build_chapters(words, transcript_text, language=language)

                podcast_ref.set({
                    "chapters": chapters,
                    "chaptersUpdatedAt": firestore.SERVER_TIMESTAMP,
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
        ui_language = (data.get("language") or "").strip().lower()

        if not text:
            return jsonify({"error": "No text provided"}), 400
        if not podcast_id:
            return jsonify({"error": "Missing podcastId"}), 400

        # (optional) ensure logged in
        user_id = session.get("user_id") or get_current_user_email()
        if not user_id:
            return jsonify({"error": "Not logged in"}), 401

        text = text[:12000]
        if ui_language in ("ar", "en"):
            is_ar = ui_language == "ar"
        else:
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

        # âœ… Save into Firestore (and ensure ownership)
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
            "summaryLanguage": "ar" if is_ar else "en",
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


@app.get("/api/podcasts/<podcast_id>/transcript")
def get_podcast_transcript(podcast_id):
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

    tdoc = ref.collection("transcripts").document("main").get()
    if not tdoc.exists:
        return jsonify(words=[])

    tdata = tdoc.to_dict() or {}
    return jsonify(words=tdata.get("words") or [])


@app.post("/api/podcasts/<podcast_id>/save-all")
def save_all_podcast(podcast_id):
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

    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    audio_url = (payload.get("audioUrl") or payload.get("audio_url") or "").strip()
    summary = payload.get("summary")
    chapters = payload.get("chapters")
    words = payload.get("words")
    transcript_text = payload.get("transcriptText")

    updates = {}
    if title:
        updates["title"] = title
    if audio_url:
        updates["audioUrl"] = audio_url
        updates["audioUpdatedAt"] = firestore.SERVER_TIMESTAMP
    if summary is not None:
        updates["summary"] = summary
        updates["summaryUpdatedAt"] = firestore.SERVER_TIMESTAMP
    if isinstance(chapters, list):
        updates["chapters"] = chapters
        updates["chaptersUpdatedAt"] = firestore.SERVER_TIMESTAMP

    if words and not transcript_text:
        try:
            transcript_text = build_transcript_text_with_speakers(words)
        except Exception:
            transcript_text = None

    if transcript_text:
        updates["transcriptText"] = transcript_text
        updates["transcriptUpdatedAt"] = firestore.SERVER_TIMESTAMP

    updates["status"] = "saved"
    updates["savedAt"] = firestore.SERVER_TIMESTAMP

    if updates:
        ref.set(updates, merge=True)

    if isinstance(words, list) and words:
        ref.collection("transcripts").document("main").set({
            "words": words,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)

    return jsonify(ok=True)


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

    email = (data.get("email") or "").strip().lower()
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
        "displayName": name or "",
        "bio": "",
        "avatarUrl": "",
        "username_lower": (name or "").lower(),
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
    data = request.get_json(silent=True) or {}

    identifier = (data.get("identifier") or data.get("email") or "").strip()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"error": "Email/username and password are required"}), 400

    users = db.collection("users")
    user_data = None
    user_email = None

    if "@" in identifier:
        # Support existing records that may have been stored with mixed-case email.
        email_candidates = [identifier, identifier.lower()]
        for candidate in email_candidates:
            doc = users.document(candidate).get()
            if doc.exists:
                user_data = doc.to_dict() or {}
                user_email = user_data.get("email") or candidate
                break
    else:
        username = identifier.lower()
        username_docs = list(
            users.where("username_lower", "==", username).limit(2).stream()
        )
        if not username_docs:
            # Backward compatibility for older users without username_lower.
            username_docs = list(users.where("name", "==", identifier).limit(2).stream())

        if len(username_docs) > 1:
            return jsonify({"error": "Multiple users match this username. Please log in with email."}), 409
        if len(username_docs) == 1:
            user_data = username_docs[0].to_dict() or {}
            user_email = user_data.get("email") or username_docs[0].id

    if not user_data:
        return jsonify({"error": "Invalid email/username or password"}), 401

    stored_hash = user_data.get("password_hash")

    if not stored_hash or not check_password_hash(stored_hash, password):
        return jsonify({"error": "Invalid email/username or password"}), 401

    token = create_token(user_email, user_email)
    
    session["user_id"] = user_email
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
        "displayName": name,
        "bio": "",
        "avatarUrl": "",
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
        print("ًں”¥ OAuth login error:", e)
        return jsonify(error="Invalid or expired OAuth token"), 401

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
