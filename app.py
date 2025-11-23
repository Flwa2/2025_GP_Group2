# app.py

from flask import (
    Flask,
    render_template,
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
from io import BytesIO
from elevenlabs.client import ElevenLabs
import os
import requests
import re
import firebase_admin
from firebase_admin import credentials, firestore
import json
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

CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"]
)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


# Server-side sessions (for create_draft, etc.)
app.config.update(
    SECRET_KEY= "WeCast2025",
    SESSION_TYPE="filesystem",  # store sessions on disk
    SESSION_FILE_DIR="./.flask_session",
    SESSION_PERMANENT=False,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # HTTP, not HTTPS
)
Session(app)

# Load .env
load_dotenv()
app.secret_key = "supersecretkey"

def create_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    return token

# ------------------------------------------------------------
# API Clients (OpenAI + ElevenLabs)
# ------------------------------------------------------------

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

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
    """Detect if input text is Arabic."""
    for c in text:
        if "\u0600" <= c <= "\u06ff" or "\u0750" <= c <= "\u08ff":
            return True
    return False


def rebalance_script_speakers(script: str, speakers_info: list) -> str:
    """
    Re-label dialogue lines so that *all* speakers in speakers_info
    actually get turns, بدون ما نخرب عناوين الأقسام والمؤثرات.
    """
    if not script or not speakers_info:
        return script

    names = []
    for i, s in enumerate(speakers_info):
        nm = (s.get("name") or "").strip()
        if not nm:
            nm = (s.get("role") or "").strip() or f"Speaker {i+1}"
        names.append(nm)

    if not names:
        return script

    n = len(names)
    idx = 0
    new_lines = []

    for ln in script.splitlines():
        original = ln
        stripped = ln.strip()

        if not stripped:
            new_lines.append(original)
            continue

        if re.fullmatch(r"\[[^\]]+\]", stripped):
            new_lines.append(original)
            continue

        if re.fullmatch(r"[-_=*~•·]+", stripped):
            new_lines.append(original)
            continue

        if re.fullmatch(r"(intro|body|outro)[:：]?\s*$", stripped, re.IGNORECASE):
            new_lines.append(original)
            continue

        m_head = re.match(
            r"^([^:：]+)[:：]\s*(intro|body|outro)\s*$",
            stripped,
            re.IGNORECASE,
        )
        if m_head:
            new_lines.append(original)
            continue

        m = re.match(r"^([^:：]+)[:：]\s*(.+)$", stripped)
        if m:
            text_after = m.group(2).strip()
            if not text_after:
                new_lines.append(original)
                continue

            new_speaker = names[idx % n]
            idx += 1
            leading_ws = original[: len(original) - len(original.lstrip())]
            new_lines.append(f"{leading_ws}{new_speaker}: {text_after}")
            continue

        if re.search(r"\w", stripped, re.UNICODE):
            new_speaker = names[idx % n]
            idx += 1
            leading_ws = original[: len(original) - len(original.lstrip())]
            new_lines.append(f"{leading_ws}{new_speaker}: {stripped}")
        else:
            new_lines.append(original)

    return "\n".join(new_lines)



def generate_podcast_script(description: str, speakers_info: list, script_style: str):
    """Generate a structured podcast script where ALL speakers talk,
    and remove only headings and bracket lines without touching the real script content.
    """

    # Detect Arabic
    arabic_instruction = (
        "Please write the script in Arabic." if is_arabic(description) else ""
    )

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

--------------------
INTRO
--------------------
- Greet listeners.
- Introduce topic + speakers.

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
    final_script = rebalance_script_speakers(cleaned_raw, speakers_info)

    return final_script




def generate_title_from_script(script: str, script_style: str = "") -> str:
    """Generate a short, catchy podcast episode title (4–8 words)."""
    if not script.strip():
        return "Untitled Episode"

    style_label = script_style or "General"

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
\"\"\"{script[:4000]}\"\"\"
"""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You write concise, catchy podcast titles."
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )
    return (resp.choices[0].message.content or "").strip()


def extract_show_title_and_template(script: str):
    """
    Detect the podcast *show* name inside the intro
    and return (show_title, script_template_with_placeholder).
    """
    if not script.strip():
        return "Podcast Show", script  # fallback

    # Look only in the first few lines where the intro is
    lines = script.splitlines()
    head = "\n".join(lines[:10])

    # Example we saw:
    # host: Welcome, listeners, to another episode of "Cultural Conversations," where...
    match = re.search(r'episode of\s+"([^"]+)"', head, flags=re.IGNORECASE)
    if not match:
        # more generic fallback: first quoted thing in the intro
        match = re.search(r'"([^"]+)"', head)
    if not match:
        return "Podcast Show", script  # nothing found, don’t break anything

    show_title = match.group(1)

    # Replace ONLY the first occurrence of the show title with the placeholder
    script_template = script.replace(show_title, SHOW_TITLE_PLACEHOLDER, 1)

    return show_title, script_template


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
    Simple fake user profile for Account.jsx (can be replaced later with real auth).
    """
    return jsonify(
        displayName="WeCast User",
        handle="@wecast",
        bio="I create AI-powered podcasts with WeCast.",
        avatarUrl="",
        email="user@example.com",
        settings={"darkMode": False},
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
    #    (uses the helper you added earlier)
    show_title, script_template = extract_show_title_and_template(script)

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
    payload = request.get_json(silent=True) or {}
    edited = (
        payload.get("edited_script") or request.form.get("edited_script") or ""
    ).strip()

    if not edited:
        return jsonify(error="Script cannot be empty."), 400

    # Update session draft but KEEP existing title
    draft = session.get("create_draft", {})
    draft["script"] = edited
    session["create_draft"] = draft

    # ---- Firestore save (you already have db configured above) ----
    try:
        user_id = session.get("user_id", "anonymous")
        doc_ref = db.collection("scripts").add(
            {
                "user_id": user_id,
                "script_style": draft.get("script_style"),
                "title": draft.get("title"),          # 👈 save episode title
                "script": edited,
                "speakers_info": draft.get("speakers_info"),
                "description": draft.get("description"),
                "saved_at": firestore.SERVER_TIMESTAMP,
            }
        )
        print("✅ Firestore save OK",
              "user_id=", user_id,
              "doc_id=", doc_ref[1].id)
    except Exception as e:
        print("⚠ Firestore save FAILED:", e)

    return jsonify(ok=True)


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

        # 🔥 Remove markdown headings (# Title)
        if line.startswith("#"):
            continue

        # 🔥 Remove INTRO / BODY / OUTRO labels
        if re.fullmatch(r"(intro|body|outro)[:：]?\s*$", line, re.IGNORECASE):
            continue

        # 🔥 Remove "Speaker: INTRO"
        if re.match(r"^([^:：]+)[:：]\s*(intro|body|outro)\s*$", line, re.IGNORECASE):
            continue

        # 🔥 Remove standalone sound cue lines except [music]
        if re.fullmatch(r"\[[^\]]+\]", line):
            if line.lower() != "[music]":
                continue

        # 🔥 Remove ANY inline tag like [laugh], [pause], [music], etc.
        line = re.sub(r"\[[^\]]*]", "", line)

        # 🔥 Remove leftover unicode formatting characters
        line = re.sub(r"[\u200B-\u200D\uFEFF]", "", line)

        # 🔥 Remove long separators like ---- or ••••
        if re.fullmatch(r"[-_=*~•·\u2022]{2,}", line):
            continue

        # 🔥 Remove speaker labels ("ga: Hello" → "Hello")
        line = re.sub(r"^[A-Za-z0-9]{1,10}\s*[:：]\s*", "", line)

        # 🔥 Remove accidental leftover beginning symbols
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
    music_index = 0
    script = (script or "").strip()
    if not script:
        return False, "Script is empty."

    segments = parse_script_into_segments(script)
    if not segments:
        return False, "Nothing to read after cleaning script."

    speaker_to_voice, default_voice = build_speaker_voice_map()

    audio_parts = []   # <-- store pieces here

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

        text = clean_script_for_tts(text)

        if text.strip():
            voice_id = speaker_to_voice.get(speaker, default_voice)
            tts_audio = b""

            for chunk in voice_client.text_to_speech.convert(
                voice_id=voice_id,
                model_id="eleven_turbo_v2",
                text=text,
            ):
                if chunk:
                    tts_audio += chunk

            speech_segment = AudioSegment.from_file(BytesIO(tts_audio), format="mp3")
            audio_parts.append(speech_segment)

    # -----------------------------
    # COMBINE EVERYTHING CLEANLY
    # -----------------------------
    if not audio_parts:
        return False, "No audio data generated."

    final_audio = AudioSegment.silent(duration=500)

    for item in audio_parts:
        final_audio += item


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

    session["introMusic"] = data.get("introMusic", "")
    session["bodyMusic"] = data.get("bodyMusic", "")
    session["outroMusic"] = data.get("outroMusic", "")

    return jsonify(ok=True)


# ------------------------------------------------------------
# HTML/Jinja routes (legacy /create flow)
# ------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    # For React SPA
    return redirect("http://localhost:5173/", code=302)


@app.route("/home")
def home():
    return render_template("index.html")


@app.route("/create", methods=["GET", "POST"], endpoint="create_page")
def create_page():
    errors = {}
    valid_hint = None
    speakers_info = []
    script_style = ""
    description = ""
    speakers_count = 0
    script = None

    if request.method == "POST":
        script_style = (request.form.get("script_style") or "").strip()
        speakers_count_raw = (request.form.get("speakers") or "").strip()
        description = (request.form.get("description") or "").strip()

        word_count = len([w for w in description.split() if w.strip()])

        if not script_style:
            errors["script_style"] = "Please select a podcast style."

        if not speakers_count_raw.isdigit() or not (1 <= int(speakers_count_raw) <= 3):
            errors["speakers"] = "Please select a number of speakers between 1 and 3."
        else:
            speakers_count = int(speakers_count_raw)

        if not description:
            errors["description"] = "Please enter your text."
        elif word_count > 2500:
            errors["description"] = "The text exceeds the 2500-word limit."

        if speakers_count_raw.isdigit():
            speakers_info = []
            for i in range(1, int(speakers_count_raw) + 1):
                name = (request.form.get(f"speaker_name_{i}") or "").strip()
                gender = request.form.get(f"speaker_gender_{i}", "Male")
                role = request.form.get(f"speaker_role_{i}", "host")
                speakers_info.append({"name": name, "gender": gender, "role": role})

            if any(s["name"] == "" for s in speakers_info):
                errors["speaker_names"] = "Please provide a name for all speakers."

            def _is_valid_name(s: str) -> bool:
                s = (s or "").strip()
                return bool(s) and bool(
                    re.fullmatch(r"[^\W\d_]+(?:\s+[^\W\d_]+)*", s, re.UNICODE)
                )

            def _normalize_for_compare(s: str) -> str:
                return " ".join((s or "").strip().split()).lower()

            invalid_names = [
                s["name"] for s in speakers_info if not _is_valid_name(s["name"])
            ]
            if invalid_names:
                errors["speaker_names"] = (
                    "Speaker names may contain letters and spaces only — no numbers or symbols."
                )

            norms = [_normalize_for_compare(s["name"]) for s in speakers_info]
            if len(norms) != len(set(norms)):
                errors["speaker_names"] = (
                    "Speaker names must be unique within the podcast."
                )

            if not errors.get("speakers") and not errors.get("speaker_names"):
                valid, message = validate_roles(script_style, speakers_info)
                if not valid:
                    errors["style_mismatch"] = message
                else:
                    valid_hint = message.replace("valid setups:", "Valid setups:")

        if "description" not in errors and word_count < 500:
            errors["description"] = (
                f"Your text must be at least 500 words. Current length: {word_count}."
            )

        if errors:
            open_step = 2 if errors.get("description") else 1
            return (
                render_template(
                    "create.html",
                    errors=errors,
                    script_style=script_style,
                    speakers_count=speakers_count,
                    speakers_info=speakers_info,
                    description=description,
                    valid_hint=valid_hint,
                    script=None,
                    open_step=open_step,
                ),
                400,
            )

        script = generate_podcast_script(description, speakers_info, script_style)
        session["create_draft"] = {
            "script_style": script_style,
            "speakers_count": speakers_count,
            "speakers_info": speakers_info,
            "description": description,
            "script": script,
        }
        return render_template(
            "ScriptEdit.html",
            script=script,
            original_speakers=[s["name"] for s in speakers_info],
            success="Your script is ready! You can edit and export it now.",
        )

    step = request.args.get("step", default="1")
    restore = request.args.get("restore", default="0") == "1"

    try:
        open_step = int(step)
    except ValueError:
        open_step = 1

    if restore and "create_draft" in session:
        draft = session["create_draft"]
        script_style = draft.get("script_style", "")
        speakers_count = draft.get("speakers_count", 0)
        speakers_info = draft.get("speakers_info", [])
        description = draft.get("description", "")
        open_step = 2

    return render_template(
        "create.html",
        errors={},
        script_style=script_style,
        speakers_count=speakers_count,
        speakers_info=speakers_info,
        description=description,
        valid_hint=None,
        script=None,
        open_step=open_step,
    )


@app.route("/wait")
def wait_page():
    """Temporary loading screen before showing the generated script."""
    return render_template("wait.html")


@app.route("/edit", methods=["POST"])
def edit():
    edited_script = request.form.get("edited_script")
    if edited_script is None:
        edited_script = request.form.get("scriptText", "")
    edited_script = (edited_script or "").strip()

    if not edited_script:
        return render_template(
            "ScriptEdit.html", script=edited_script, error="Script cannot be empty."
        )

    lines = edited_script.splitlines()
    if not any(":" in line for line in lines):
        return render_template(
            "ScriptEdit.html",
            script=edited_script,
            error="You must keep speaker lines (like 'Host:' or 'Guest:').",
        )

    return render_template(
        "ScriptEdit.html", script=edited_script, success="Script saved successfully!"
    )


@app.route("/generate_audio", methods=["POST"])
def generate_audio():
    """
    Legacy HTML route for audio generation (ScriptEdit.html form).
    Uses the same multi-voice logic as /api/audio.
    """
    script = (request.form.get("scriptText") or "").strip()

    ok, result = synthesize_audio_from_script(script)
    if not ok:
        return {"error": result}, 400

    # ✅ store for legacy flow as well
    session["last_audio_url"] = result
    session.modified = True

    return {"url": result}

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
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")
    name = data.get("name")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # collection: users, document id = email
    user_ref = db.collection("users").document(email)
    if user_ref.get().exists:
        return jsonify({"error": "User already exists"}), 409

    password_hash = generate_password_hash(password)

    user_ref.set(
        {
            "email": email,
            "name": name or "",
            "password_hash": password_hash,
            "created_at": datetime.utcnow().isoformat(),
            "role": "user",
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
