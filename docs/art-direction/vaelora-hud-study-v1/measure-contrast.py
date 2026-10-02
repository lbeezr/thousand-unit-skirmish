"""Read screenshots and CSS metadata. No image pixels are modified."""
from pathlib import Path
import json, math, re
from PIL import Image

PACK = Path(__file__).resolve().parent

def rgb(css):
    values = re.findall(r'[\d.]+', css)
    return tuple(float(v) for v in values[:3])

def luminance(color):
    def linear(v):
        v /= 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return sum(w * linear(v) for w, v in zip((.2126, .7152, .0722), color))

def measure(sample, screenshot):
    x, y, w, h = sample['rect']
    opacity = sample.get('opacity', 1)
    foreground = rgb(sample['color'])
    ratios = []
    for py in range(max(0, math.ceil(y + 2)), min(screenshot.height, math.floor(y + h - 2)), 2):
        for px in range(max(0, math.ceil(x + 2)), min(screenshot.width, math.floor(x + w - 2)), 2):
            background = screenshot.getpixel((px, py))[:3]
            paint = tuple(v * opacity + b * (1 - opacity) for v, b in zip(foreground, background))
            a, b = luminance(paint), luminance(background)
            ratios.append((max(a, b) + .05) / (min(a, b) + .05))
    if not ratios:
        return None
    inactive = sample.get('disabled', sample.get('inactive', False))
    target = 3 if inactive else 4.5
    return dict(sample, backgroundSamples=len(ratios), minimumSampledContrast=round(min(ratios), 3), maximumSampledContrast=round(max(ratios), 3), target=target, belowTarget=min(ratios) < target)

def proposal():
    rows = []
    data = json.loads((PACK / 'previews/render-review.json').read_text())
    for result in data['results']:
        for check in result['backgroundStateChecks']:
            filename = '-'.join((check['theme'], check['terrain'], check['state'])) + '-text-background.png'
            screenshot = Image.open(PACK / 'previews' / filename).convert('RGB')
            for sample in check['samples']:
                # This parent includes an internally bordered objective link.
                if sample['selector'] == '.objective small':
                    continue
                measured = measure(sample, screenshot)
                if measured:
                    rows.append(dict(theme=check['theme'], terrain=check['terrain'], state=check['state'], **measured))
    report = dict(date='2026-10-02', method='2px interior rectangle grid over captured text-hidden backgrounds; computed CSS foreground; conservative samples, not glyph masks', normalTextTarget=4.5, inactiveTextTarget=3, sourceRevision='68f859f903ad09119594dcafca83f6de8362a9ed', limitations=['Only the named prototype text regions at 1280x1100 DPR1.', 'Mixed objective-description/link parent excluded.', 'No native OS cursor, glyph-shape, color-vision or human readability certification.'], rows=rows)
    (PACK / 'contrast-proposals.json').write_text(json.dumps(report, indent=2) + '\n')
    for theme in ('journal', 'wood', 'map'):
        selected = [r for r in rows if r['theme'] == theme]
        print(theme, 'regions', len(selected), 'below', sum(r['belowTarget'] for r in selected), 'minimum', min(r['minimumSampledContrast'] for r in selected))

if __name__ == '__main__':
    proposal()
