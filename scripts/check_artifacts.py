"""Verify public package contents, shared runtime and Python metadata."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
release = root / 'dist/releases'
core = (root / 'dist/cli.cjs').read_bytes()
expected = hashlib.sha256(core).hexdigest()

def safe(names):
    for name in names:
        assert not any(part in name.lower() for part in ['credentials', 'client_secret', '.env', '.artifacts', 'node_modules', '__pycache__']), name

with tarfile.open(release / f'searchdock-cli-{version}.tgz') as package:
    safe(package.getnames())
    assert hashlib.sha256(package.extractfile('package/dist/cli.cjs').read()).hexdigest() == expected
    assert 'package/plugin.json' in package.getnames()
    assert 'package/skills/searchdock/SKILL.md' in package.getnames()

wheel = release / f'searchdock_cli-{version}-py3-none-any.whl'
sdist = release / f'searchdock_cli-{version}.tar.gz'
with zipfile.ZipFile(wheel) as package:
    safe(package.namelist())
    assert hashlib.sha256(package.read('searchdock_cli/_core/cli.cjs')).hexdigest() == expected
with tarfile.open(sdist) as package:
    safe(package.getnames())
    assert any(name.endswith('/_core/cli.cjs') for name in package.getnames())
for archive in release.glob('*.zip'):
    with zipfile.ZipFile(archive) as package:
        safe(package.namelist())
subprocess.run([sys.executable, '-m', 'twine', 'check', str(wheel), str(sdist)], check=True)
print('Public package contents, matching runtimes and Python metadata verified.')
