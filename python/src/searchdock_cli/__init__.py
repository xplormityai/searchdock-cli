"""Python launcher for the shared SearchDock Node.js core."""
from pathlib import Path
import shutil
import subprocess
import sys

from ._version import __version__


def main():
    node = shutil.which('node')
    if not node:
        print('SearchDock requires Node.js 22 or later. Install it from https://nodejs.org/', file=sys.stderr)
        return 1
    try:
        version = subprocess.check_output([node, '--version'], text=True).strip()
        if int(version.lstrip('v').split('.')[0]) < 22:
            raise ValueError()
    except (OSError, ValueError, subprocess.CalledProcessError):
        print('SearchDock requires Node.js 22 or later.', file=sys.stderr)
        return 1
    core = Path(__file__).parent / '_core/cli.cjs'
    if not core.is_file():
        print('The SearchDock runtime is missing. Reinstall the package.', file=sys.stderr)
        return 1
    try:
        return subprocess.call([node, str(core), *sys.argv[1:]])
    except KeyboardInterrupt:
        return 130
    except OSError:
        print('Could not start the SearchDock runtime.', file=sys.stderr)
        return 1
