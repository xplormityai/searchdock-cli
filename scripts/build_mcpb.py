"""Build an allowlisted local MCP bundle from the standalone CLI build."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
manifest = json.loads((root / 'mcpb.json').read_text(encoding='utf-8'))
manifest['version'] = package['version']
destination = root / 'dist/releases'
destination.mkdir(parents=True, exist_ok=True)
with ZipFile(destination / f"searchdock-cli-{package['version']}.mcpb", 'w', ZIP_DEFLATED) as bundle:
    bundle.writestr('manifest.json', json.dumps(manifest, indent=2) + '\n')
    bundle.write(root / 'dist/cli.cjs', 'server/cli.cjs')
    bundle.write(root / 'dist/THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md')
    bundle.write(root / 'LICENSE', 'LICENSE')
    bundle.write(root / 'README.md', 'README.md')
print('Built standalone SearchDock MCP bundle.')
