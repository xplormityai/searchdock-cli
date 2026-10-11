"""Produce allowlisted public plugin and standalone skill archives."""
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
version = sys.argv[1]
destination = root / 'dist/releases'
files = ['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json',
         '.claude-plugin/plugin.json', 'README.md', 'LICENSE']
files += [str(path.relative_to(root)).replace('\\', '/') for path in (root / 'skills').rglob('*') if path.is_file()]
with ZipFile(destination / f'searchdock-plugin-{version}.zip', 'w', ZIP_DEFLATED) as bundle:
    for file in files:
        bundle.write(root / file, file)
with ZipFile(destination / f'searchdock-skill-{version}.zip', 'w', ZIP_DEFLATED) as bundle:
    for path in (root / 'skills/searchdock').rglob('*'):
        if path.is_file():
            bundle.write(path, 'searchdock/' + str(path.relative_to(root / 'skills/searchdock')).replace('\\', '/'))
print('Built public plugin and standalone skill archives.')
