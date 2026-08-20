from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime

JS_MARKER = "/* ===== MEMEFLOW CLEAN SYSTEM V29 ===== */"
CSS_MARKER = "/* ===== MEMEFLOW CLEAN SYSTEM V29 ===== */"

CAMERA_FUNCTION = '''function mf29Camera(reset = true) {
  const mobile = window.matchMedia('(max-width: 900px)').matches;

  app.camera.fov = mobile ? 40 : 35;
  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    0,
    mobile ? 7.35 : 6.35,
    mobile ? 17.35 : 14.45
  );

  app.targetHome.set(
    mobile ? -0.38 : -0.30,
    mobile ? -0.06 : -0.22,
    mobile ? 0.72 : 0.78
  );

  if (reset) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.enablePan = false;
  app.controls.enableZoom = true;
  app.controls.minDistance = mobile ? 10.2 : 8.8;
  app.controls.maxDistance = 24;
  app.controls.zoomSpeed = 1.02;
  app.controls.rotateSpeed = 0.50;
  app.controls.minAzimuthAngle = -0.46;
  app.controls.maxAzimuthAngle = 0.46;
  app.controls.minPolarAngle = Math.PI * 0.235;
  app.controls.maxPolarAngle = Math.PI * 0.455;
  app.controls.autoRotate = false;
  app.autoRotate = false;
  app.controls.update();
}'''

FINAL_CSS = '''/* ===== MEMEFLOW CLEAN SYSTEM V29 ===== */

html,
body {
  background: #020507;
}

.viewport-wrap {
  background:
    radial-gradient(ellipse at 50% 31%, rgba(22, 91, 90, .055), transparent 35%),
    linear-gradient(180deg, #02070a 0%, #010507 64%, #010405 100%);
  box-shadow: inset 0 0 72px rgba(0, 0, 0, .46);
}

.viewport-wrap::after {
  opacity: .05;
}

#systemCanvas {
  cursor: grab;
  filter: contrast(1.12) saturate(1.01) brightness(1.035);
  -webkit-tap-highlight-color: transparent;
}

#systemCanvas:active {
  cursor: grabbing;
}

.scene-labels,
.node-label {
  display: none;
}

@media (max-width: 900px) {
  html,
  body {
    width: 100%;
    height: 100%;
    min-height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
  }

  body {
    min-height: 100dvh;
  }

  .system-shell {
    width: 100%;
    height: 100dvh;
    min-height: 0;
    padding: 6px;
    display: grid;
    grid-template-rows: 52px minmax(0, 1fr) 116px;
    gap: 6px;
    overflow: hidden;
  }

  .topbar {
    height: 52px;
    min-height: 52px;
    margin: 0;
    padding: 6px 9px;
    border-radius: 13px;
    grid-template-columns: 1fr auto;
  }

  .brand-block {
    gap: 7px;
  }

  .brand {
    font-size: 12px;
  }

  .subtitle,
  .system-chips,
  .top-actions .tool-btn:first-child {
    display: none;
  }

  .back {
    width: 34px;
    height: 34px;
  }

  .brand-mark {
    width: 29px;
    height: 29px;
  }

  .tool-btn {
    height: 34px;
    padding: 0 10px;
    font-size: 8px;
  }

  .viewport-wrap {
    position: relative;
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-rows: minmax(260px, 1fr) auto 58px;
    gap: 6px;
    border-radius: 15px;
    overflow: hidden;
  }

  #systemCanvas {
    position: relative !important;
    inset: auto !important;
    grid-column: 1;
    grid-row: 1;
    width: 100% !important;
    height: 100% !important;
    min-width: 0;
    min-height: 0;
    display: block;
    align-self: stretch;
    justify-self: stretch;
  }

  .scene-title {
    left: 9px;
    right: 9px;
    top: 8px;
    width: auto;
    padding: 7px 9px;
    border-radius: 10px;
    pointer-events: none;
  }

  .scene-title .eyebrow {
    font-size: 5px;
    letter-spacing: .17em;
  }

  .scene-title h1 {
    margin: 3px 0 0;
    font-size: 13px;
    line-height: 1.05;
  }

  .scene-title p {
    display: none;
  }

  .legend {
    left: 9px;
    top: 60px;
    gap: 7px;
    padding: 4px 6px;
    border-radius: 8px;
    pointer-events: none;
  }

  .legend span {
    font-size: 5px;
    gap: 4px;
  }

  .legend-dot {
    width: 5px;
    height: 5px;
  }

  .scene-hint {
    display: none;
  }

  .inspector {
    position: relative !important;
    inset: auto !important;
    grid-column: 1;
    grid-row: 2;
    width: auto;
    max-height: none;
    min-height: 0;
    margin: 0 8px;
    padding: 8px 9px;
    border-radius: 12px;
    overflow: hidden;
    z-index: 8;
  }

  .inspector-head {
    min-height: 24px;
  }

  .inspector h2 {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.05;
  }

  .inspector .eyebrow {
    font-size: 5px;
  }

  .inspector-summary,
  .gate-list,
  .inspector-foot {
    display: none;
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    margin-top: 5px;
  }

  .metric-card {
    min-width: 0;
    padding: 5px 6px;
    border-radius: 8px;
  }

  .metric-card span {
    font-size: 4.5px;
  }

  .metric-card strong {
    margin-top: 2px;
    font-size: 8px;
  }

  .reason-block {
    margin-top: 5px;
    padding: 5px 7px;
  }

  .reason-block span {
    font-size: 4.5px;
  }

  .reason-block p {
    margin-top: 2px;
    font-size: 6.5px;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .state-pill {
    font-size: 5.5px;
    padding: 3px 6px;
  }

  .telemetry {
    position: relative !important;
    inset: auto !important;
    grid-column: 1;
    grid-row: 3;
    width: auto;
    height: 58px;
    min-height: 58px;
    margin: 0 8px 8px;
    padding: 5px 6px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    border-radius: 10px;
    z-index: 8;
  }

  .telemetry-item {
    min-width: 0;
    padding: 2px 6px;
  }

  .telemetry-item:nth-child(n + 4) {
    display: none;
  }

  .telemetry-item span {
    font-size: 4.5px;
  }

  .telemetry-item strong {
    margin-top: 2px;
    font-size: 10px;
  }

  .telemetry-item small {
    font-size: 4.5px;
    margin-left: 2px;
  }

  .activity-panel {
    min-height: 0;
    height: 116px;
    margin: 0;
    padding: 7px 9px;
    border-radius: 13px;
    overflow: hidden;
  }

  .activity-head h2 {
    font-size: 10px;
  }

  .activity-actions {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .flow-view-all {
    padding: 5px 8px;
    border: 1px solid rgba(85, 217, 255, .26);
    border-radius: 8px;
    color: #9fdff3;
    text-decoration: none;
    font-size: 6.5px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .token-rail {
    height: 72px;
    gap: 7px;
    padding-top: 6px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .token-card {
    flex: 0 0 150px;
    min-height: 64px;
    padding: 6px 8px;
    border-radius: 9px;
  }

  .token-symbol {
    font-size: 8.5px;
  }

  .token-state {
    font-size: 5.5px;
  }

  .token-card-meta {
    gap: 3px;
    margin-top: 4px;
  }

  .token-card-meta span {
    font-size: 5.5px;
  }

  .token-card-meta b {
    font-size: 6.5px;
  }
}
'''


def locate_files():
    here = Path.cwd()
    candidates = [here, here / "memeflow-app", here.parent / "memeflow-app"]

    for root in candidates:
        if (
            root.joinpath("system.js").is_file()
            and root.joinpath("system.css").is_file()
            and root.joinpath("system.html").is_file()
        ):
            return root.resolve()

    raise RuntimeError("system.js, system.css and system.html were not found")


def syntax_check(path):
    result = subprocess.run(
        ["node", "--check", str(path)],
        text=True,
        capture_output=True
    )
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip()
            or result.stdout.strip()
            or "node --check failed"
        )


def main():
    root = locate_files()
    js_path = root / "system.js"
    css_path = root / "system.css"
    html_path = root / "system.html"

    js = js_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    if js.count(JS_MARKER) != 1:
        raise RuntimeError("CLEAN V29 is not installed exactly once in system.js")

    if css.count(CSS_MARKER) != 1:
        raise RuntimeError("CLEAN V29 is not installed exactly once in system.css")

    camera_pattern = re.compile(
        r"function mf29Camera\(reset = true\) \{.*?\n\}",
        re.S
    )

    js_new, count = camera_pattern.subn(CAMERA_FUNCTION, js, count=1)

    if count != 1:
        raise RuntimeError(f"Expected one mf29Camera function, found {count}")

    css_index = css.index(CSS_MARKER)
    css_new = css[:css_index].rstrip() + "\n\n" + FINAL_CSS.strip() + "\n"

    html_new = re.sub(
        r'href="/system\.css(?:\?[^\"]*)?"',
        'href="/system.css?v=clean-v29-1"',
        html,
        count=1
    )
    html_new = re.sub(
        r'src="/system\.js(?:\?[^\"]*)?"',
        'src="/system.js?v=clean-v29-1"',
        html_new,
        count=1
    )

    if html_new == html:
        raise RuntimeError("HTML cache version was not updated")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backups = {
        js_path: js_path.with_name(f"system.js.before-v29-1-{stamp}"),
        css_path: css_path.with_name(f"system.css.before-v29-1-{stamp}"),
        html_path: html_path.with_name(f"system.html.before-v29-1-{stamp}")
    }

    for source, backup in backups.items():
        shutil.copy2(source, backup)

    try:
        js_path.write_text(js_new, encoding="utf-8")
        css_path.write_text(css_new, encoding="utf-8")
        html_path.write_text(html_new, encoding="utf-8")

        syntax_check(js_path)

        if js_new.count(JS_MARKER) != 1:
            raise RuntimeError("V29 JS marker count changed unexpectedly")

        if css_new.count(CSS_MARKER) != 1:
            raise RuntimeError("V29 CSS marker count changed unexpectedly")

    except Exception:
        for target, backup in backups.items():
            shutil.copy2(backup, target)
        raise

    print("CLEAN V29.1 MOBILE LAYOUT INSTALLED")
    print(f"Project: {root}")
    print("3D scene reduced and centered on mobile")
    print("Inspector moved below the 3D canvas")
    print("Telemetry moved below Inspector")
    print("Token Flow remains at the bottom")
    print("V29 interaction logic preserved")
    print("Syntax check passed")
    print("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
