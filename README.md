# 🎙️ WeCast

## Graduation Project Group 2

WeCast is the final software package for Graduation Project Group 2. It is an AI-powered podcast generation platform that helps users convert written content into complete podcast episodes with generated scripts, realistic voices, cover art, transcripts, chapters, summaries, sharing, and download support.

## 📂 Software Package Structure

The submitted software package should include the following items:

```text
Submission Package
│
├── GP2_WeCast_Software/
├── GP2_WeCast_Executable
└── README.md
```

- `GP2_WeCast_Software/`: complete source code folder for the WeCast application.
- `GP2_WeCast_Executable`: packaged executable, startup script, or deployment entry used to launch the WeCast system.
- `README.md`: documentation file containing setup, run, testing, repository, and notes.

## 🚀 Project Overview

WeCast is an AI-powered podcast generation platform. The system allows users to create podcast episodes from written text by combining AI text generation, voice generation, audio processing, and publishing features.

WeCast follows a client-server architecture where the React frontend communicates with a Flask backend API. AI services such as OpenAI and ElevenLabs are integrated for script generation, voice synthesis, summary generation, and media generation, while Firebase handles authentication, saved podcasts, Firestore data, and storage.

## 📸 Screenshots

### Home Page

[Insert Home Page screenshot]

### Podcast Preview Page

[Insert Podcast Preview Page screenshot]

## ✨ Key Features

- AI script generation from user-provided content.
- Multi-speaker voice generation.
- Transition music between podcast sections.
- Interactive transcript display.
- Automatically generated chapters.
- AI-generated episode summary.
- Podcast cover art generation and upload.
- Episode preview, sharing, and download features.
- Saved podcast management for authenticated users.

## 🛠️ Technologies Used

- Frontend: React, Vite, Tailwind CSS
- Backend: Flask, Python
- Database and Storage: Firebase Authentication, Firestore, Firebase Storage / configured object storage
- AI Services: OpenAI, ElevenLabs
- Audio Processing: FFmpeg, pydub
- Email Services: Resend, SMTP
- Deployment: Render, if deployed through the included Render configuration

## ✅ Prerequisites

Before running WeCast locally, ensure the following software is installed:

- Python 3.10 or newer
- Node.js and npm
- FFmpeg
- Git

## ⚙️ Installation Instructions

### 1. Clone the GitHub Repository

```bash
git clone https://github.com/GhalaMus/2025_GP_Group2.git
cd 2025_GP_Group2
```

If the submitted folder is named `GP2_WeCast_Software`, open that folder instead:

```bash
cd GP2_WeCast_Software
```

### 2. Install Backend Dependencies

Create and activate a Python virtual environment, then install the backend requirements:

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

On macOS or Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd static/frontend
npm install
```

Return to the project root when needed:

```bash
cd ../..
```

### 4. Set Up Environment Variables

Create a `.env` file in the project root for backend configuration. Also configure frontend environment variables in `static/frontend/.env` when required by the deployment or local setup.

Do not commit real API keys, service credentials, or secret files to GitHub.

### 5. Run the Backend

From the project root:

```bash
python app.py
```

The backend server runs by default at:

```text
http://127.0.0.1:5000
```

### 6. Run the Frontend

From the project root:

```bash
npm run dev
```

Or from the frontend folder:

```bash
cd static/frontend
npm run dev
```

The frontend development server runs by default at:

```text
http://localhost:5173
```

## ▶️ Run Instructions

To start WeCast locally, run the backend and frontend in two separate terminals.

Terminal 1: backend

```bash
python app.py
```

Terminal 2: frontend

```bash
npm run dev
```

Then open the application in a browser:

```text
http://localhost:5173
```

If the backend and frontend ports are changed, update the frontend API base URL and backend CORS/frontend-origin configuration accordingly.

## 🔐 Environment Variables

The following variables are examples of the required configuration values. Use placeholders during documentation and replace them only in local `.env` files or secure deployment settings.

```env
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket

RESEND_API_KEY=your_resend_api_key
SMTP_HOST=your_smtp_host
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

FRONTEND_PUBLIC_URL=your_frontend_public_url
WECAST_APP_URL=your_wecast_app_url
```

Frontend Firebase variables may also be required:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_API_BASE_URL=your_backend_api_url
```

If object storage is configured separately for generated media, add the relevant storage provider variables in the secure backend environment.

## 🧪 Testing Information

Use the following placeholders for submission testing if final public credentials or URLs are not available:

```text
Email: test@example.com
Password: Test@12345
Frontend URL: [add deployed frontend URL]
Backend URL: [add deployed backend URL]
```

Suggested testing checklist:

- Create or log in to a test account.
- Generate a podcast script from sample written content.
- Generate multi-speaker audio using the available voice options.
- Verify transition music is included where selected.
- Review the podcast preview page.
- Check transcript highlighting during playback.
- Open and review generated chapters.
- Open and review the generated summary.
- Generate or upload cover art.
- Save the podcast to the user account.
- Test sharing from the public share page.
- Download the generated audio file.

AI features require valid API keys and may fail if the API quota, billing, or provider configuration is unavailable.

## 🔗 Official Repository

Official Repository:

```text
https://github.com/GhalaMus/2025_GP_Group2
```

## ⚠️ Known Limitations

- AI generation depends on third-party API availability, billing status, and quota limits.
- Audio generation performance may vary depending on internet connection and hardware resources.
- Some advanced features require valid cloud service configuration.
- Email delivery requires correct Resend or SMTP settings.
- Local audio processing requires FFmpeg to be installed and available in the system path.

## 📝 Notes

- API keys are required for AI script generation, voice generation, summary generation, and cover art generation.
- Firebase configuration is required for authentication, saved podcasts, Firestore data, and storage configuration.
- FFmpeg must be installed locally and available in the system path if backend audio processing depends on it.
- Email features require Resend or SMTP configuration.
- Do not commit real API keys, `.env` files, Firebase service account files, or other secret credentials.
- For deployment, configure all secrets through the hosting provider dashboard or secure environment settings.
