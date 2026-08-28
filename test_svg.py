import sys
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
import os

svg_path = 'public/images/logo/logo.svg'
print('CWD:', os.getcwd(), file=sys.stderr)
print('SVG exists:', os.path.exists(svg_path), file=sys.stderr)

with open(svg_path, 'r') as f:
    content = f.read()
print('SVG content:', file=sys.stderr)
print(content, file=sys.stderr)
print('---END SVG---', file=sys.stderr)

try:
    drawing = svg2rlg(svg_path)
    print('Drawing object:', drawing, file=sys.stderr)
    if drawing:
        print('Drawing width:', getattr(drawing, 'width', None), file=sys.stderr)
        print('Drawing height:', getattr(drawing, 'height', None), file=sys.stderr)
        print('Drawing minWidth:', getattr(drawing, 'minWidth', None), file=sys.stderr)
        print('Drawing minHeight:', getattr(drawing, 'minHeight', None), file=sys.stderr)
        print('Drawing scale:', getattr(drawing, 'scale', None), file=sys.stderr)
        
        # Try to render
        if hasattr(drawing, 'width') and drawing.width and drawing.height:
            renderPM.drawToFile(drawing, 'public/images/logo/logo.png', fmt='PNG')
            print('PNG created:', os.path.exists('public/images/logo/logo.png'), file=sys.stderr)
            if os.path.exists('public/images/logo/logo.png'):
                print('PNG size:', os.path.getsize('public/images/logo/logo.png'), file=sys.stderr)
        else:
            print('No valid dimensions', file=sys.stderr)
except Exception as e:
    print('Error:', e, file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)