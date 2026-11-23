"""Build the standalone interface with its solver embedded (no dependencies)."""
from pathlib import Path
import json
import shutil

root = Path(__file__).resolve().parent
source = root / 'output/cube-centers.html'
fragment = source.read_text(encoding='utf-8')
script = fragment.split('<script>', 1)[1].split('</script>', 1)[0]
fragment = '<div id="cube-centers" aria-label="4x4, 5x5 and 6x6 cube practice workspace">\n<style>\n' + (root / 'app.css').read_text(encoding='utf-8') + '\n</style>\n' + (root / 'layout.html').read_text(encoding='utf-8') + '\n<script>' + script + '</script>\n</div>\n'
start, end = '// BEGIN GENERATED SOLVER', '// END GENERATED SOLVER'
before, rest = fragment.split(start, 1)
_, after = rest.split(end, 1)
before = before[:before.index('    const CubeModel =')] + (root / 'cube-model.js').read_text(encoding='utf-8')
database = json.loads((root / 'data/l2c-cases.json').read_text(encoding='utf-8'))
yau_database = json.loads((root / 'data/yau-cases.json').read_text(encoding='utf-8'))
scripts = '\n'.join((root / name).read_text(encoding='utf-8') for name in ['orientation.js', 'solver.js', 'expanded-solver.js', 'case-library.js', 'case-browser.js', 'community-solutions.js', 'yau.js', 'trainer.js', 'workspace.js', 'mode-transfer.js', 'six-ida.js', 'six-cache.js', 'six-notation.js', 'six.js', 'four.js', 'f3e.js', 'f3e-search.js', 'l8e.js', 'l8e-search.js', 'l8e-spatial.js', 'l8e-examples.js'])
l8e_examples = json.loads((root / 'data/l8e-examples.json').read_text())
if not all(group.get('subclasses') for group in l8e_examples['classes']):
    raise ValueError('Generate spatial examples with node scripts/generate-l8e-spatial-examples.cjs before building.')
if not all(example.get('upperSolutions') for group in l8e_examples['classes'] for example in group['examples']):
    raise ValueError('Generate U-layer examples with node scripts/generate-l8e-upper-examples.cjs before building.')
scripts += '\nconst L8E_EXAMPLES = ' + json.dumps(l8e_examples, separators=(',', ':')) + ';\n'
alternatives = json.loads((root / 'data/optimal-alternatives.json').read_text())
scripts += '\nconst OPTIMAL_ALTERNATIVES = ' + json.dumps(alternatives, separators=(',', ':')) + ';\n'
fragment = before + start + '\n' + scripts + '\nconst L2C_DATABASE = ' + json.dumps(database, separators=(',', ':')) + ';\nconst YAU_DATABASE = ' + json.dumps(yau_database, separators=(',', ':')) + ';\n' + end + after
if not fragment.isascii():
    raise ValueError('App display text must use plain ASCII characters. Use escapes for Unicode input handling.')
document = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Big Cube Lab</title>
<style>:root{color-scheme:light dark}body{margin:0;background:light-dark(#f5f6f8,#14171d)}*{box-sizing:border-box}</style>
</head><body>''' + fragment + '</body></html>\n'
source.write_text(document, encoding='utf-8')
(root / 'output/cube-interface.html').write_text(document, encoding='utf-8')
print('Built output/cube-interface.html')

shutil.copytree(root / 'vendor/cstimer', root / 'output/vendor/cstimer', dirs_exist_ok=True)
