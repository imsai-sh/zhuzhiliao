from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]
APP_WEB = REPOSITORY / "harmonyos" / "entry" / "src" / "main" / "resources" / "rawfile" / "web"
SHARED_FILES = (
    Path("3d/boot3d.js"),
    Path("3d/model.js"),
    Path("3d/vendor/OrbitControls.js"),
    Path("3d/vendor/three.module.min.js"),
)
FORBIDDEN_OFFLINE_SNIPPETS = (
    "vibecafe.ai/telemetry",
    "new WebSocket(",
    "sendBeacon(",
    "serviceWorker' in navigator",
    'serviceWorker" in navigator',
)
REQUIRED_OFFLINE_SNIPPETS = (
    "const HARMONY_OFFLINE = true;",
    "function getNativeMotionBridge()",
    "pollNativeMotion();",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Check or synchronize Web assets shared with the HarmonyOS app.")
    parser.add_argument("--check", action="store_true", help="Check assets without changing files (default).")
    parser.add_argument("--write", action="store_true", help="Copy shared assets from the repository root.")
    args = parser.parse_args()
    if args.check and args.write:
        parser.error("choose either --check or --write")

    if args.write:
        for relative in SHARED_FILES:
            destination = APP_WEB / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(REPOSITORY / relative, destination)

    mismatches: list[str] = []
    for relative in SHARED_FILES:
        source = REPOSITORY / relative
        destination = APP_WEB / relative
        if not source.is_file() or not destination.is_file() or digest(source) != digest(destination):
            mismatches.append(str(relative))

    index = (APP_WEB / "index.html").read_text(encoding="utf-8")
    policy_errors = [f"forbidden snippet: {snippet}" for snippet in FORBIDDEN_OFFLINE_SNIPPETS if snippet in index]
    policy_errors.extend(
        f"missing required snippet: {snippet}" for snippet in REQUIRED_OFFLINE_SNIPPETS if snippet not in index
    )

    failures = mismatches + policy_errors
    if failures:
        raise SystemExit("Web snapshot validation failed:\n- " + "\n- ".join(failures))

    print(f"Web snapshot validation passed for {len(SHARED_FILES)} shared assets.")


if __name__ == "__main__":
    main()
