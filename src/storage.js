import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SearchDockError } from './errors.js';

export function configDirectory(env = process.env, platform = process.platform) {
  if (env.SEARCHDOCK_CONFIG_DIR) return resolve(env.SEARCHDOCK_CONFIG_DIR);
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'SearchDock');
  if (platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'SearchDock');
  return join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'searchdock');
}

export function profileName(value = 'default') {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)) throw new SearchDockError('Profile names must use 1–64 letters, numbers, underscores or hyphens.');
  return value;
}

function protectWindows(path) {
  if (process.platform !== 'win32') return;
  try {
    const sid = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { encoding: 'utf8', windowsHide: true }).trim();
    if (!/^S-1-\d+(?:-\d+)+$/.test(sid)) throw new Error();
    execFileSync('icacls.exe', [path, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'ignore', windowsHide: true });
  } catch {
    throw new SearchDockError('Could not protect the local credentials directory with Windows permissions.');
  }
}

export class Store {
  constructor(directory = configDirectory()) { this.directory = resolve(directory); }
  path(profile) { return join(this.directory, `${profileName(profile)}.json`); }
  async read(profile = 'default', optional = false) {
    try {
      const data = JSON.parse(await readFile(this.path(profile), 'utf8'));
      if (data.version !== 1 || typeof data.google !== 'object' || !data.google) throw new Error();
      return data;
    } catch (error) {
      if (optional && error.code === 'ENOENT') return { version: 1, google: {} };
      throw new SearchDockError('This profile is not connected or its configuration is invalid. Run searchdock auth login --client-file <file>.');
    }
  }
  async write(profile, data) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    protectWindows(this.directory);
    const path = this.path(profile);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      await rename(temporary, path);
    } finally { await rm(temporary, { force: true }); }
  }
  async remove(profile) { await rm(this.path(profile), { force: true }); }
}
