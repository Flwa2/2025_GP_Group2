from flask import Flask, render_template, request, redirect, url_for, session
from openai import OpenAI
import os
from dotenv import load_dotenv
from elevenlabs import ElevenLabs


app = Flask(__name__)
load_dotenv()
app.secret_key = "supersecretkey"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")
voice_client = ElevenLabs(api_key=ELEVEN_API_KEY)

def is_arabic(text):
    """Detect if input text is Arabic."""
    for c in text:
        if '\u0600' <= c <= '\u06FF' or '\u0750' <= c <= '\u08FF':
            return True
    return False


def generate_podcast_script(description: str, speakers_info: list, script_style: str):
    """Generate a structured podcast script combining accuracy rules and style-based creativity."""
    arabic_instruction = "Please write the script in Arabic." if is_arabic(description) else ""
    num_speakers = len(speakers_info)
    speaker_info_text = "\n".join([
        f"- {s['name']} ({s['gender']}, {s['role']})"
        for s in speakers_info
    ])

    # ---- Style specific writing behavior ----
    style_guidelines = {
    "Interview": """
• Tone: Professional, journalistic, and engaging.
• Flow: Q&A format — the host(s) ask thoughtful questions, guests answer with insights and short stories.
• Pacing: Dynamic but realistic, maintaining curiosity.
• Goal: Inform and connect through authentic dialogue.
""",
    "Storytelling": """
• Tone: Cinematic and narrative — it should feel like telling a story through voices.
• Flow: 
   - If there is **one host**, the host tells the story.  
   - If there is **one host and one guest**, the guest tells the story while the host guides or reacts.  
   - If there is **one host and two guests**, the guests tell the story while the host guides or reacts.  
• Goal: Emotionally immerse the listener and bring visuals to life through voice.
""",
    "Educational": """
• Tone: Clear, structured, and friendly.  
• Flow: The host explains the topic, and the guests ask questions to guide understanding.  
• Pacing: Logical and organized — break concepts into small, easy-to-follow sections.  
• Goal: Help listeners learn while keeping the flow interactive and engaging.
""",
    "Conversational": """
• Tone: Relaxed, funny, and natural — like friends chatting over coffee.
• Flow: Both speakers share personal thoughts, reactions, and stories.
• Pacing: Casual with natural pauses, some humor, and occasional laughter.
• Goal: Make the audience feel part of a real conversation.
"""
}


    style_rules = style_guidelines.get(script_style, "")

    # ---- prompt ----
    prompt = f"""
You are a professional podcast scriptwriter.

There should be {num_speakers} speaker(s) in the dialogue.
The following are the speakers:
{speaker_info_text}

The script style should be: {script_style}

Your task is to transform the following text into a podcast script.

[START TEXT]
{description}
[END TEXT]

{arabic_instruction}

-----------------------------
STRUCTURE & SOUND RULES
-----------------------------
Every podcast must include:

### INTRO
- Greet the audience and introduce the topic and speakers.
- Add [Soft intro music fades in].

### BODY
- Present the main dialogue naturally, following the text’s main ideas.
- Include transitions like [Music fades out], [Soft background music resumes], [Pause effect].

### OUTRO
- Summarize key takeaways or closing thoughts.
- Add [Outro music fades out] at the end.

-----------------------------
WRITING RULES
-----------------------------
- Use ONLY the provided text as your content base.
- Do NOT add or remove any factual information.
- Make it sound natural, flowing, and conversational.
- Keep speaker labels clear (e.g., Host:, Guest:).
- Avoid narration or stage directions outside [sound tags].
- Do not use bullet points or markdown formatting.
- Every line must start with a speaker’s name followed by a colon.
- The dialogue must feel authentic and realistic.

-----------------------------
STYLE PERSONALITY
-----------------------------
Adapt your tone, phrasing, and rhythm according to the selected style:
{style_rules}

Now generate the full podcast script following all these instructions faithfully.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a creative, structured, and professional podcast scriptwriter."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.75,
    )
    return response.choices[0].message.content.strip()



def validate_roles(style, speakers_info):
    """Check valid role combinations for each podcast style."""
    roles = [s['role'] for s in speakers_info]
    valid = True
    message = ""

    if style == "Interview":
        valid_setups = [["host", "guest"], ["host", "host", "guest"]]
        if roles not in valid_setups:
            valid = False
            message = "For 'Interview' style, valid setups: 1 host → 1 guest or 2 hosts → 1 guest."

    elif style == "Storytelling":
        valid_setups = [["host"], ["host", "guest"], ["host", "guest", "guest"]]
        if roles not in valid_setups:
            valid = False
            message = "For 'Storytelling' style, valid setups: 1 host solo, 1 host → 1 guest, or 1 host → 2 guests."

    elif style == "Educational":
        valid_setups = [["host"], ["host", "guest"], ["host", "guest", "guest"]]
        if roles not in valid_setups:
            valid = False
            message = "For 'Educational' style, valid setups: 1 host solo, 1 host → 1 guest, or 1 host → 2 guests."

    elif style == "Conversational":
        valid_setups = [["host", "guest"], ["host", "host"]]
        if roles not in valid_setups:
            valid = False
            message = "For 'Conversational' style, valid setups: 1 host → 1 guest, or all hosts."

    return valid, message


# ---------------------- ROUTES ----------------------

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/home")
def home():
    return render_template("index.html")


from flask import render_template, request

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
        # --------- Read inputs once ---------
        script_style = (request.form.get("script_style") or "").strip()
        speakers_count_raw = (request.form.get("speakers") or "").strip()
        description = (request.form.get("description") or "").strip()

        # Precompute word count once
        word_count = len([w for w in description.split() if w.strip()])

        # --------- Basic validations ---------
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

        # --------- Speaker data collection ---------
        if speakers_count_raw.isdigit():
            speakers_info = []
            for i in range(1, int(speakers_count_raw) + 1):
                name = (request.form.get(f"speaker_name_{i}") or "").strip()
                gender = request.form.get(f"speaker_gender_{i}", "Male")
                role = request.form.get(f"speaker_role_{i}", "host")
                speakers_info.append({"name": name, "gender": gender, "role": role})

            # Missing names (kept, but stricter rules below will handle too)
            if any(s["name"] == "" for s in speakers_info):
                errors["speaker_names"] = "Please provide a name for all speakers."

            # --------- Speaker name validation (letters + spaces only, unique) ---------
            import re

            def _is_valid_name(s: str) -> bool:
                """
                Allow only letters (any language) and single/multiple spaces between words.
                Requires at least one letter per word.
                """
                s = (s or "").strip()
                # [^\W\d_] == letter, so require 1+ letters, then groups of (spaces + 1+ letters)
                return bool(s) and bool(re.fullmatch(r"[^\W\d_]+(?:\s+[^\W\d_]+)*", s, re.UNICODE))

            def _normalize_for_compare(s: str) -> str:
                """Lowercase and collapse multiple spaces to detect duplicates sanely."""
                return " ".join((s or "").strip().split()).lower()

            invalid_names = [s["name"] for s in speakers_info if not _is_valid_name(s["name"])]
            if invalid_names:
                errors["speaker_names"] = (
                    "Speaker names may contain letters and spaces only — no numbers or symbols."
                )

            norms = [_normalize_for_compare(s["name"]) for s in speakers_info]
            if len(norms) != len(set(norms)):
                errors["speaker_names"] = "Speaker names must be unique within the podcast."

            # --------- Role/style validation ---------
            if not errors.get("speakers") and not errors.get("speaker_names"):
                valid, message = validate_roles(script_style, speakers_info)
                if not valid:
                    errors["style_mismatch"] = message
                else:
                    valid_hint = message.replace("valid setups:", "Valid setups:")

        # --------- 500-word minimum (don’t override earlier description errors) ---------
        if "description" not in errors and word_count < 500:
            errors["description"] = f"Your text must be at least 500 words. Current length: {word_count}."

        # --------- Any errors? Re-render create with the right step open ---------
        if errors:
            # Open Step 2 if the description/text failed, else Step 1
            open_step = 2 if errors.get("description") else 1
            return render_template(
                "create.html",
                errors=errors,
                script_style=script_style,
                speakers_count=speakers_count,
                speakers_info=speakers_info,
                description=description,
                valid_hint=valid_hint,
                script=None,
                open_step=open_step
            ), 400

        # --------- Success: generate and go to Step 3 (Edit) ---------
        script = generate_podcast_script(description, speakers_info, script_style)
        session["create_draft"] = {
            "script_style": script_style,
            "speakers_count": speakers_count,
            "speakers_info": speakers_info,   # list of dicts: [{"name":..., "gender":..., "role":...}, ...]
            "description": description
        }
        return render_template(
            "ScriptEdit.html",
            script=script,
            original_speakers=[s["name"] for s in speakers_info]
        )

    # --------- GET: allow /create?step=2 to open Step 2, and restore if asked ---------
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
        # force Step 2 open when restoring
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
        open_step=open_step
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
        return render_template("ScriptEdit.html", script=edited_script, error="Script cannot be empty.")

    lines = edited_script.splitlines()
    if not any(":" in line for line in lines):
        return render_template("ScriptEdit.html", script=edited_script,
                               error="You must keep speaker lines (like 'Host:' or 'Guest:').")

    return render_template("ScriptEdit.html", script=edited_script, success="Script saved successfully!")

@app.route("/generate_audio", methods=["POST"])
def generate_audio():
    script = request.form.get("scriptText", "").strip()
    if not script:
        return {"error": "Script is empty."}, 400

    try:
        # Generate audio file (MP3)
        output_path = os.path.join("static", "output.mp3")

        # ElevenLabs returns an iterator (stream) — so write each chunk
        with open(output_path, "wb") as f:
            for chunk in voice_client.text_to_speech.convert(
                voice_id="Rachel",  # pick your voice
                model_id="eleven_turbo_v2",
                text=script,
            ):
                if chunk:  # ensure not None
                    f.write(chunk)

        # Return the URL for playback in the browser
        return {"url": url_for("static", filename="output.mp3")}
    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)
