"""Smoke-test npm's executable and the Python wheel without global installation."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
release = root / 'dist/releases'
npm = shutil.which('npm')
if not npm:
    raise RuntimeError('npm is required for package installation verification.')

with tempfile.TemporaryDirectory(prefix='searchdock-install-test-') as directory:
    target = Path(directory) / 'python'
    subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', '--no-deps', '--disable-pip-version-check',
                    '--target', str(target), str(release / f'searchdock_cli-{version}-py3-none-any.whl')], check=True)
    env = dict(os.environ, PYTHONPATH=str(target), SEARCHDOCK_CONFIG_DIR=str(Path(directory) / 'config'))
    python = [sys.executable, '-m', 'searchdock_cli']
    npm_args = [npm, 'exec', '--yes', '--package', str(release / f'searchdock-cli-{version}.tgz'), '--', 'searchdock']
    for command, shell in [(python, False), (npm_args, os.name == 'nt')]:
        result = subprocess.run([*command, '--version'], env=env, cwd=directory, text=True, capture_output=True, shell=shell, timeout=120)
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == version, result.stdout
        result = subprocess.run([*command, 'providers', '--json'], env=env, cwd=directory, text=True, capture_output=True, shell=shell, timeout=120)
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout)['providers'][0]['id'] == 'google'
    print('npm executable and installed Python wheel both work outside the source checkout.')
