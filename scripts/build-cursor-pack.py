"""Build native cursor PNGs from approved offline Meshy renders plus 2D state marks.
Requires Pillow. Source renders remain unchanged; only the small runtime pack ships.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/ui/cursors'
S = 4
SIZE = 40
INK = '#142019'
PALE = '#f6e7c8'
GOLD = '#dfb06b'
RED = '#ef8775'
STATES = ['select','select-add','select-remove','box-select','box-crossing','move','move-queued',
          'attack','attack-move','attack-move-queued','gather','gather-wood','rally',
          'build-valid','build-blocked','unavailable']

def base(tool=False):
    im=Image.open(ROOT/'art/cursor-sources'/('hammer.png' if tool else 'pointer.png')).convert('RGBA')
    im=im.crop(im.getchannel('A').getbbox())
    im.thumbnail((29*S,31*S),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(SIZE*S,SIZE*S))
    canvas.alpha_composite(im,(8*S if tool else 4*S,7*S if tool else 4*S))
    alpha=canvas.getchannel('A')
    outline=Image.new('RGBA',canvas.size,INK)
    outline.putalpha(alpha.filter(ImageFilter.MaxFilter(2*S+1)))
    outline.alpha_composite(canvas)
    return outline

def marks(im,state):
    d=ImageDraw.Draw(im)
    def line(points,fill=PALE,width=2): d.line([(int(x*S),int(y*S)) for x,y in points],fill=fill,width=int(width*S),joint='curve')
    def poly(points,fill=PALE): d.polygon([(int(x*S),int(y*S)) for x,y in points],fill=fill)
    def circle(box,fill=None,outline=PALE,width=1.5): d.ellipse(tuple(int(v*S) for v in box),fill=fill,outline=outline,width=int(width*S))
    if state.startswith('build'):
        circle((2,2,10,10),fill=INK)
        line([(0,6),(12,6)],width=1);line([(6,0),(6,12)],width=1)
        if state=='build-blocked':
            circle((22,22,39,39),fill=INK,outline=RED)
            line([(26,26),(35,35)],RED,2.5);line([(35,26),(26,35)],RED,2.5)
        return
    if state=='select':return
    circle((22,22,39,39),fill=INK,outline=GOLD,width=1)
    if state in ['select-add','select-remove']:
        line([(26,30),(35,30)])
        if state=='select-add':line([(30.5,26),(30.5,35)])
    elif state.startswith('box'):
        if state=='box-select':line([(26,26),(35,26),(35,35),(26,35),(26,26)],width=1.5)
        else:
            for x,y,dx,dy in [(26,26,3,0),(32,26,3,0),(26,35,3,0),(32,35,3,0),(26,29,0,3),(35,29,0,3)]:line([(x,y),(x+dx,y+dy)],width=1.5)
    elif state.startswith('attack'):
        poly([(26,26),(28,26),(35,33),(33,35)])
        line([(26,34),(34,26)],GOLD,2)
        if 'move' in state:line([(25,21),(28,18),(31,21)],GOLD,1.5)
    elif state.startswith('move'):
        line([(27,26),(33,30),(27,35)],PALE,2)
    elif state=='gather':
        for x,y in [(28,28),(32,28),(30,32)]:circle((x-2,y-2,x+2,y+2),fill=RED,outline=None)
        line([(29,25),(33,24)],'#bcd28b',2)
    elif state=='gather-wood':
        line([(27,35),(32,26)],GOLD,2)
        poly([(26,26),(30,24),(34,28),(31,31)],PALE)
    elif state=='rally':
        line([(27,25),(27,36)],PALE,1.5);poly([(28,25),(36,25),(33,28),(36,30),(28,30)],GOLD)
    elif state=='unavailable':
        circle((25,25,36,36),outline=RED,width=2);line([(26,26),(35,35)],RED,2)
    if state.endswith('queued'):
        line([(31,19),(38,19)],PALE,1.5);line([(34.5,15.5),(34.5,22.5)],PALE,1.5)

manifest=json.loads((OUT/'manifest.json').read_text())
manifest.update(kit='frontier-commander-meshy-v1',cursorSize=[40,40])
manifest['cursors']={}
for state in STATES:
    tool=state.startswith('build')
    im=base(tool);marks(im,state)
    im.resize((SIZE,SIZE),Image.Resampling.LANCZOS).save(OUT/f'{state}.png',optimize=True)
    manifest['cursors'][state]={'source':'scripts/build-cursor-pack.py','runtime':f'assets/ui/cursors/{state}.png',
        'hotspot':[6,6] if tool else [4,4],'fallback':'not-allowed' if state in ['build-blocked','unavailable'] else 'default'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Built {len(STATES)} cursor states at {SIZE}px')
