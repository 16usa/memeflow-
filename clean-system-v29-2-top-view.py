from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime

CAMERA_FUNCTION = r"""function mf29Camera(reset = true) {
  const mobile = window.matchMedia('(max-width: 900px)').matches;

  /*
    Default / Reset view:
    high three-quarter top view so every module display
    remains readable while preserving a small amount of depth.
  */
  app.camera.fov = mobile ? 39 : 36;
  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    mobile ? -0.15 : -0.10,
    mobile ? 19.2 : 18.4,
    mobile ? 7.1 : 6.6
  );

  app.targetHome.set(
    mobile ? -0.34 : -0.28,
    mobile ? -0.18 : -0.20,
    mobile ? 0.62 : 0.66
  );

  if (reset) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.enablePan = false;
  app.controls.enableZoom = true;
  app.controls.minDistance = mobile ? 10.0 : 8.8;
  app.controls.maxDistance = 28;
  app.controls.zoomSpeed = 1.02;
  app.controls.rotateSpeed = 0.50;

  /*
    OrbitControls polar angle is measured from +Y.
    The old minimum angle prevented a real top view.
  */
  app.controls.minPolarAngle = Math.PI * 0.10;
  app.controls.maxPolarAngle = Math.PI * 0.47;

  app.controls.minAzimuthAngle = -0.62;
  app.controls.maxAzimuthAngle = 0.62;

  app.controls.autoRotate = false;
  app.autoRotate = false;
  app.controls.update();
}"""


def find_project():
    current = Path.cwd()
    candidates = [
        current,
        current / "memeflow-app",
        current.parent / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
    ]

    for root in candidates:
        if (
            (root / "system.js").is_file()
            and (root / "system.html").is_file()
        ):
            return root.resolve()

    raise RuntimeError("MEMEFLOW project was not found")


def check_js(path):
    result = subprocess.run(
        ["node", "--check", str(path)],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip()
            or result.stdout.strip()
            or "node --check failed"
        )


def main():
    root = find_project()
    js_path = root / "system.js"
    html_path = root / "system.html"

    js = js_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    if "MEMEFLOW CLEAN SYSTEM V29" not in js:
        raise RuntimeError("CLEAN V29 was not found in system.js")

    pattern = re.compile(
        r"function mf29Camera\(reset = true\) \{.*?\n\}",
        re.S
    )

    js_new, count = pattern.subn(CAMERA_FUNCTION, js, count=1)

    if count != 1:
        raise RuntimeError(
            f"Expected exactly one mf29Camera function, found {count}"
        )

    html_new = re.sub(
        r'src="/system\.js(?:\?[^"]*)?"',
        'src="/system.js?v=clean-v29-2-top-view"',
        html,
        count=1
    )

    if html_new == html:
        raise RuntimeError("system.js cache version was not updated")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    js_backup = js_path.with_name(
        f"system.js.before-v29-2-{stamp}"
    )
    html_backup = html_path.with_name(
        f"system.html.before-v29-2-{stamp}"
    )

    shutil.copy2(js_path, js_backup)
    shutil.copy2(html_path, html_backup)

    try:
        js_path.write_text(js_new, encoding="utf-8")
        html_path.write_text(html_new, encoding="utf-8")
        check_js(js_path)
    except Exception:
        shutil.copy2(js_backup, js_path)
        shutil.copy2(html_backup, html_path)
        raise

    print("CLEAN V29.2 TOP VIEW INSTALLED")
    print(f"Project: {root}")
    print("Default camera moved to a high top view")
    print("Reset view now returns to the same top view")
    print("Top-view OrbitControls restriction removed")
    print("3D depth preserved")
    print("V29 interaction and mobile layout preserved")
    print("Syntax check passed")
    print("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
