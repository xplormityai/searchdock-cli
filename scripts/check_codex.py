"""Optional plugin installation smoke test in an isolated Codex home."""
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
codex = sys.argv[1] if len(sys.argv) > 1 else 'codex'
with tempfile.TemporaryDirectory(prefix='searchdock-codex-test-') as directory:
    env = dict(os.environ, CODEX_HOME=directory)
    for args in [['plugin', 'marketplace', 'add', str(root), '--json'],
                 ['plugin', 'add', 'searchdock@searchdock', '--json']]:
        result = subprocess.run([codex, *args], env=env, cwd=root, text=True, capture_output=True, timeout=60)
        if result.returncode:
            raise RuntimeError(result.stderr)
        json.loads(result.stdout)
    print('Codex accepted the marketplace and installed the plugin in an isolated test profile.')
