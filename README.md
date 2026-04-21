# WeCast: AI-Powered Podcast Generator
## Introduction
WeCast is an AI-powered web application designed to simplify the podcast creation process. The tool transforms written text into engaging, multi-speaker conversations with realistic voices, background music, and cover art. It reduces the technical and financial barriers of podcast production by integrating advanced AI capabilities, making professional-quality podcasts more accessible to individuals, small teams, and organizations.
## Technology
**Hardware Tools:**
- High-performance laptop.

**Software Tools:**
- Development Tools: Visual Studio Code, Postman.
- Frontend: HTML, CSS.
- AI & NLP Frameworks: Python, TTS libraries.
- Visual & Design Tools: Figma, Three.js, DALL·E by OpenAI.
- Backend & Database: Flask, Firebase, Firebase Storage.
- Audio processing tools: FFmpeg.
- Authentication & Notifications: Firebase Authentication, Nodemailer.
## Launching Instructions
- **Accessing the Website:** Users will be able to directly access WeCast through the hosted link we will provide. No installation or setup is required.
- **Viewing the Source Code:**
  
  1- Clone the repository and install dependencies
  
  2- Open the project in Visual Studio Code (or any IDE) to browse through the codebase.

## Local Development
To run the project locally, start both the backend and frontend:

1. Activate the virtual environment and install Python packages:
   `pip install -r requirements.txt`
2. In one terminal, start Flask from the repository root:
   `python app.py`
3. In another terminal, start the React frontend from the repository root:
   `npm run dev`

The backend runs on `http://127.0.0.1:5000` and redirects `/` to the frontend at `http://localhost:5173`.

If you want a cleaner PowerShell developer terminal for this project, run:

- `npm run dev:status` to see a safe masked status summary
- `npm run dev:shell` to open a styled WeCast shell with helper commands

Inside the WeCast shell, you can use:

- `wecast-status`
- `wecast-backend`
- `wecast-frontend`
- `wecast-root`

## Custom Account Emails
Custom password reset emails and profile email-change confirmations use Resend when these environment variables are set:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME` (optional)
- `WECAST_SUPPORT_EMAIL` (optional)
- `WECAST_APP_URL` (recommended, for correct action links)
- `WECAST_LOGO_URL` (optional, for branded email templates)

If Resend is not configured, password reset falls back to Firebase's hosted email flow and custom profile email-change messages stay unavailable.
