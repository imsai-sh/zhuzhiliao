from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "web-responsive"
BASE_URL = os.environ.get("ZZL_TEST_URL", "http://127.0.0.1:8123/")
CHROMIUM = os.environ.get("ZZL_CHROMIUM")
VIEWPORTS = [
    ("phone-compact", 320, 568),
    ("phone-short", 360, 640),
    ("phone-portrait", 390, 844),
    ("tablet-portrait", 800, 1280),
    ("tablet-landscape", 1280, 800),
    ("desktop-wide", 1440, 900),
]


def overlaps(a: dict, b: dict) -> bool:
    return not (
        a["right"] <= b["left"]
        or b["right"] <= a["left"]
        or a["bottom"] <= b["top"]
        or b["bottom"] <= a["top"]
    )


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report: list[dict] = []
    failures: list[str] = []

    with sync_playwright() as pw:
        launch_options: dict = {"headless": True}
        if CHROMIUM:
            launch_options["executable_path"] = CHROMIUM
        browser = pw.chromium.launch(**launch_options)
        for name, width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
                reduced_motion="reduce",
            )
            context.add_init_script(
                """
                window.__nativeMotionMock = { active: false, tick: 0 };
                window.HarmonyMotion = {
                  start() {
                    window.__nativeMotionMock.active = true;
                    window.__nativeMotionMock.tick = 0;
                    return true;
                  },
                  stop() { window.__nativeMotionMock.active = false; },
                  getSample() {
                    const mock = window.__nativeMotionMock;
                    if (mock.active) mock.tick += 1;
                    return JSON.stringify({
                      available: true,
                      active: mock.active,
                      x: mock.active ? Math.sin(mock.tick / 4) * 4 : 0,
                      y: mock.active ? Math.cos(mock.tick / 4) * 4 : 0,
                      z: 9.8,
                      timestamp: mock.active ? mock.tick : 0,
                    });
                  },
                };
                """
            )
            page = context.new_page()
            external_requests: list[str] = []
            console_errors: list[str] = []
            page_errors: list[str] = []

            def record_request(request) -> None:
                host = urlparse(request.url).hostname
                if host not in ("127.0.0.1", "localhost", None):
                    external_requests.append(request.url)

            page.on("request", record_request)
            page.on(
                "console",
                lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
            )
            page.on("pageerror", lambda error: page_errors.append(str(error)))

            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_timeout(900)

            state = page.evaluate(
                """
                () => {
                  const visible = el => {
                    const s = getComputedStyle(el);
                    return !el.hidden && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0;
                  };
                  const rect = selector => {
                    const el = document.querySelector(selector);
                    if (!el || !visible(el)) return null;
                    const r = el.getBoundingClientRect();
                    return { left:r.left, top:r.top, right:r.right, bottom:r.bottom,
                             width:r.width, height:r.height };
                  };
                  const controls = [...document.querySelectorAll('.panel button')]
                    .filter(visible)
                    .map(el => ({ id:el.id, width:el.getBoundingClientRect().width,
                                  height:el.getBoundingClientRect().height }));
                  return {
                    viewport: { width:innerWidth, height:innerHeight },
                    scroll: { width:document.documentElement.scrollWidth,
                              height:document.documentElement.scrollHeight },
                    canvas: rect('#cv'), hint: rect('#hint'), panel: rect('.panel'),
                    stats: rect('#stats'), masthead: rect('.masthead'), about: rect('#aboutBtn'),
                    controls,
                    harmonyOffline: typeof HARMONY_OFFLINE !== 'undefined' && HARMONY_OFFLINE,
                    appState: window.__zzl && window.__zzl.state,
                  };
                }
                """
            )

            if state["scroll"]["width"] > width:
                failures.append(f"{name}: horizontal overflow {state['scroll']['width']} > {width}")
            if not state["canvas"] or state["canvas"]["width"] <= 0 or state["canvas"]["height"] <= 0:
                failures.append(f"{name}: canvas has no drawable viewport")
            if not state["harmonyOffline"]:
                failures.append(f"{name}: offline build flag is not active")
            for control in state["controls"]:
                if control["height"] < 44:
                    failures.append(f"{name}: {control['id']} touch target is only {control['height']:.1f}px")
            for left, right in (("hint", "panel"), ("stats", "panel"), ("masthead", "about")):
                if state[left] and state[right] and overlaps(state[left], state[right]):
                    failures.append(f"{name}: {left} overlaps {right}")

            if not any(control["id"] == "motionBtn" for control in state["controls"]):
                failures.append(f"{name}: native motion control is not visible")
            page.locator("#motionBtn").click()
            page.wait_for_timeout(180)
            motion_state = page.evaluate("window.__zzl.state")
            native_motion_active = page.evaluate("window.__nativeMotionMock.active")
            if not motion_state["motion"]["on"] or not motion_state["motion"]["native"]:
                failures.append(f"{name}: native motion mode did not activate")
            if not motion_state["motion"]["gotEvent"]:
                failures.append(f"{name}: native accelerometer samples were not consumed")
            if not native_motion_active:
                failures.append(f"{name}: native bridge was not started")
            if page.locator("#motionBtn").get_attribute("aria-pressed") != "true":
                failures.append(f"{name}: motion button accessibility state was not updated")

            page.locator("#autoBtn").click()
            page.wait_for_timeout(700)
            auto_state = page.evaluate("window.__zzl.state")
            if not auto_state["auto"]:
                failures.append(f"{name}: auto mode did not activate")
            if page.locator("#autoBtn").get_attribute("aria-pressed") != "true":
                failures.append(f"{name}: auto button accessibility state was not updated")
            if page.evaluate("window.__nativeMotionMock.active"):
                failures.append(f"{name}: native bridge stayed active after switching to auto mode")

            page.locator("#aboutBtn").click()
            if not page.locator("#aboutSheet").is_visible():
                failures.append(f"{name}: about dialog did not open")
            page.locator("#aboutClose").click()
            if page.locator("#aboutSheet").is_visible():
                failures.append(f"{name}: about dialog did not close")

            screenshot = OUTPUT / f"{name}-{width}x{height}.png"
            page.screenshot(path=str(screenshot), full_page=True)

            if external_requests:
                failures.append(f"{name}: external requests detected: {external_requests}")
            if page_errors:
                failures.append(f"{name}: page errors: {page_errors}")

            report.append(
                {
                    "name": name,
                    "viewport": [width, height],
                    "layout": state,
                    "motionState": motion_state,
                    "autoState": auto_state,
                    "externalRequests": external_requests,
                    "consoleErrors": console_errors,
                    "pageErrors": page_errors,
                    "screenshot": str(screenshot),
                }
            )
            context.close()
        browser.close()

    (OUTPUT / "report.json").write_text(
        json.dumps({"failures": failures, "runs": report}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if failures:
        raise SystemExit("\n".join(failures))
    print(f"Responsive/offline smoke test passed for {len(VIEWPORTS)} viewports.")


if __name__ == "__main__":
    main()
