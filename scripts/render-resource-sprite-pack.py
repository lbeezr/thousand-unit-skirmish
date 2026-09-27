#!/usr/bin/env python3
"""Bake an existing GLB with the building pilot's eight-view camera and lighting.

No provider calls. Outputs a transparent atlas, individual frames, a contact
sheet, and provenance. Each model is fitted once across all eight views.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts/resource-sprite-capture.html"

class RenderHandler(SimpleHTTPRequestHandler):
    project: Path
    repo: Path

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.repo), **kwargs)

    def do_POST(self) -> None:  # noqa: N802
        route = unquote(urlparse(self.path).path)
        prefix = "/__save/"
        if not route.startswith(prefix):
            self.send_error(404)
            return
        relative = Path(route[len(prefix):])
        destination = (self.project / relative).resolve()
        project = self.project.resolve()
        if project not in destination.parents or relative.is_absolute() or ".." in relative.parts:
            self.send_error(400, "invalid output path")
            return
        content_length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(content_length)
        if not payload:
            self.send_error(400, "empty payload")
            return
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and not getattr(self.server, "overwrite", False):
            self.send_error(409, "refusing to overwrite an existing file")
            return
        destination.write_bytes(payload)
        self.send_response(201)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        return



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--width', type=float, required=True)
    parser.add_argument('--source-task', required=True)
    parser.add_argument('--remesh-task', required=True)
    parser.add_argument('--postprocess-only', action='store_true')
    parser.add_argument('--serve', action='store_true', help='Capture using an existing browser; prints its URL.')
    args = parser.parse_args()
    model, out = args.model.resolve(), args.output.resolve()
    if not model.is_file() or ROOT not in model.parents or ROOT not in out.parents:
        raise SystemExit('Model must exist; model and output must be inside the project.')
    out.mkdir(parents=True, exist_ok=True)
    html = TEMPLATE.read_text()
    html = html.replace('Town Center reference renderer', args.name + ' sprite capture')
    html = html.replace("'./town-center-optimized.glb'", json.dumps('/' + str(model.relative_to(ROOT))))
    html = html.replace('const ANCHOR_Y = 376;', 'const ANCHOR_Y = 480;')
    html = html.replace('const baseScale = 4 /', f'const baseScale = {args.width} /')
    # Only color is used by the current resource sprites. Keep the pilot lights,
    # normalization, eight camera headings, and conservative fit calculation.
    start = html.index('      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;')
    end = html.index('\n    }\n    restoreMaterials();', start)
    html = html[:start] + html[end:]
    html = html.replace('window.__renderDone = true;', "window.__renderDone = true; await fetch('/__save/capture-complete.json', {method: 'POST', body: '{}'});")
    (out / 'capture.html').write_text(html)
    if not args.postprocess_only:
        if (out / 'references/frames/color/view-00.png').exists():
            raise SystemExit('Frames already exist. Use --postprocess-only to repack.')
        (out / 'capture-complete.json').unlink(missing_ok=True)
        handler = type('ResourceCapture', (RenderHandler,), {'project': out, 'repo': ROOT})
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            if args.serve:
                import time
                print(f'http://127.0.0.1:{server.server_address[1]}/{out.relative_to(ROOT)}/capture.html', flush=True)
                deadline = time.monotonic() + 300
                while not (out / 'capture-complete.json').exists():
                    if time.monotonic() > deadline:
                        raise SystemExit('Browser capture timed out; existing frames retained.')
                    time.sleep(0.5)
            else:
                with tempfile.TemporaryDirectory(prefix='resource-sprite-chrome-') as profile:
                    command = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                        '--headless=new', '--no-first-run', '--no-default-browser-check',
                        '--disable-background-networking', '--disable-extensions',
                        '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader', f'--user-data-dir={profile}',
                        '--virtual-time-budget=240000', '--dump-dom',
                        f'http://127.0.0.1:{server.server_address[1]}/{out.relative_to(ROOT)}/capture.html']
                    result = subprocess.run(command, capture_output=True, text=True, timeout=300)
                    (out / 'capture.log').write_text(result.stdout + '\n' + result.stderr)
                    if result.returncode or '<title>RENDER_DONE</title>' not in result.stdout:
                        raise SystemExit(f'Capture did not finish; see {out}/capture.log')
        finally:
            server.shutdown()
            server.server_close()
    stats = json.loads((out / 'references/model-stats.json').read_text())
    atlas = Image.new('RGBA', (2560, 1280))
    contact = Image.new('RGB', (1280, 704), '#313732')
    draw = ImageDraw.Draw(contact)
    records = []
    (out / 'runtime').mkdir(exist_ok=True)
    for i, angle in enumerate(range(0, 360, 45)):
        file = out / f'references/frames/color/view-{i:02d}.png'
        frame = Image.open(file).convert('RGBA')
        bounds = frame.getchannel('A').getbbox()
        if frame.size != (640, 640) or not bounds or min(bounds[:2]) < 2 or max(bounds[2:]) > 638:
            raise SystemExit(f'Empty, clipped, or incorrectly sized frame: {file}: {bounds}')
        atlas.alpha_composite(frame, (i % 4 * 640, i // 4 * 640))
        thumb = frame.resize((320, 320), Image.Resampling.LANCZOS)
        contact.paste(thumb, (i % 4 * 320, i // 4 * 352), thumb)
        draw.text((i % 4 * 320 + 10, i // 4 * 352 + 327), f'{args.name} | view {i:02d} | azimuth {angle} deg', fill='#f5eeda')
        frame.save(out / f'runtime/{args.name}-{i:02d}.webp', lossless=True)
        records.append(dict(index=i, cameraAzimuthDegrees=angle, rect=[i % 4 * 640, i // 4 * 640, 640, 640], alphaBounds=list(bounds), sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
    atlas.save(out / f'{args.name}-atlas.png', optimize=True)
    atlas.save(out / f'{args.name}-atlas.webp', lossless=True)
    contact.save(out / 'contact-sheet.png', optimize=True)
    manifest = dict(name=args.name, status='review-candidate', sourceModel=str(model.relative_to(ROOT)),
        sourceModelSha256=hashlib.sha256(model.read_bytes()).hexdigest(),
        meshTask=args.source_task, remeshTask=args.remesh_task,
        atlas=f'{args.name}-atlas.png', atlasPixels=[2560,1280], framePixels=[640,640],
        captureMode='camera-orbit', projection='orthographic', elevationDegrees=46,
        frameWorldUnits=[5,5], pixelsPerWorldUnit=128, anchorPixelFromTopLeft=[320,480],
        lighting='Building pilot: hemisphere 1.6; warm key 2.5; cool fill 1.0; rim 0.7; ACES exposure 1.',
        viewConvention='Camera azimuth 0 looks from +Z; 90 from +X. Model is not rotated.',
        stats=stats, frames=records)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps(dict(output=str(out), frames=8, triangleCount=stats['triangleCount'], validation='nonempty, unclipped RGBA frames'), indent=2))

if __name__ == '__main__':
    main()
