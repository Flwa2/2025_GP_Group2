from pathlib import Path
import sys
import traceback

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app


def main():
    email = "flwavibes@gmail.com"
    print(f"DEBUG reset start for {email}", flush=True)
    try:
        result = app.prepare_password_reset_delivery(email, strict=False)
        print("RESULT:", result, flush=True)
    except Exception:
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
