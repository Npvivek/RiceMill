"""Export or verify the exact FastAPI OpenAPI document used for TS generation."""

import argparse
import json
from pathlib import Path

from app.main import app

OUTPUT = Path(__file__).resolve().parents[1] / "openapi.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != generated:
            raise SystemExit("OpenAPI schema drift: regenerate backend/openapi.json and frontend types")
        print("OpenAPI schema matches FastAPI")
    else:
        OUTPUT.write_text(generated)
        print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
