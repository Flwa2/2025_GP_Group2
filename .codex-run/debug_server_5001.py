from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import app


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)
