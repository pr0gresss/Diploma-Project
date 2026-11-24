import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(backend, '.secrets/codex-gateway');
const configFile = resolve(directory, 'config.yaml');
const keyFile = resolve(directory, 'client-key');
const envFile = resolve(backend, '.env');
const executable = resolve(directory, 'bin', process.platform === 'win32' ? 'cli-proxy-api.exe' : 'cli-proxy-api');
const baseURL = 'http://127.0.0.1:8317/v1';

async function updateEnvironment(values) {
  let content = '';
  try { content = await readFile(envFile, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`, 'gm');
    const line = `${name}=${value}`;
    content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile(envFile, content, { mode: 0o600 });
}

async function setup() {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await mkdir(resolve(directory, 'auth'), { recursive: true, mode: 0o700 });
  let key;
  try { key = (await readFile(keyFile, 'utf8')).trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    key = randomBytes(32).toString('hex');
    await writeFile(keyFile, key, { mode: 0o600, flag: 'wx' });
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid private client key; restore the gateway setup files');
  // These are the v8.1.2 config.example.yaml field names. No upstream API keys.
  const config = `config-version: 8\nserver:\n  host: "127.0.0.1"\n  port: 8317\nmanagement:\n  allow-remote: false\n  secret-key: ""\n  disable-control-panel: true\naccess:\n  api-keys:\n    - "${key}"\noauth:\n  auth-dir: ${JSON.stringify(resolve(directory, 'auth').replaceAll('\\', '/'))}\nrouting:\n  retry:\n    request-retry: 0\n`;
  // Fail closed on an existing custom config instead of silently replacing it.
  try { await writeFile(configFile, config, { mode: 0o600, flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = await readFile(configFile, 'utf8');
    if (!existing.includes(`"${key}"`) || !existing.includes('host: "127.0.0.1"') || !existing.includes('port: 8317')) {
      throw new Error('Existing gateway configuration differs from this local setup. Restore matching private configuration before updating the backend.');
    }
  }
  await updateEnvironment({ LLM_PROVIDER: 'codex_gateway', LLM_BASE_URL: baseURL, LLM_API_KEY: key });
  console.log('Private local gateway configuration created; Backend/.env now points to it. No credentials printed.');
}

async function run(login) {
  await access(configFile);
  await access(executable);
  const args = ['-config', configFile, ...(login ? ['-codex-device-login'] : [])];
  const child = spawn(executable, args, { cwd: directory, shell: false, windowsHide: true, stdio: 'inherit' });
  child.once('error', () => { console.error('Cannot start gateway executable. Check the pinned installation.'); process.exitCode = 1; });
  child.once('exit', (code) => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
}

async function check(model) {
  const key = (await readFile(keyFile, 'utf8')).trim();
  let response;
  try {
    response = await fetch(`${baseURL}/models`, { headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch { throw new Error('Gateway is not reachable at 127.0.0.1:8317. Run npm run ai:gateway:start in another terminal.'); }
  if (response.status === 401 || response.status === 403) throw new Error('Gateway rejected its local client key. Check that the running gateway uses .secrets/codex-gateway/config.yaml.');
  if (!response.ok) throw new Error(`Gateway model catalog returned HTTP ${response.status}. Check the private gateway logs and repeat login.`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Gateway model catalog exceeded the size limit');
    chunks.push(chunk);
  }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Gateway returned an invalid model catalog. Check its private logs.'); }
  const models = Array.isArray(result.data) ? result.data.map((entry) => entry.id).filter((id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(id)) : [];
  if (!models.length) throw new Error('Gateway is reachable but advertises no models. Run npm run ai:gateway:login and complete ChatGPT sign-in, then repeat this check.');
  console.log('Advertised gateway models:\n' + models.join('\n'));
  if (model) {
    if (!models.includes(model)) throw new Error('Requested model is not advertised; choose an ID listed above.');
    await updateEnvironment({ LLM_MODEL: model });
    console.log('LLM_MODEL saved. Restart the backend to apply it.');
  } else {
    let configured;
    try { configured = parseEnv(await readFile(envFile, 'utf8')).LLM_MODEL; } catch { /* setup supplies .env */ }
    if (!configured || !models.includes(configured)) throw new Error('LLM_MODEL is missing or unavailable. Select an advertised ID with npm run ai:gateway:model -- MODEL_ID.');
    console.log('Configured model is advertised. Catalog check only; no generation or quota check was performed.');
  }
}

try {
  const command = process.argv[2];
  if (command === 'setup') await setup();
  else if (command === 'start' || command === 'login') await run(command === 'login');
  else if (command === 'check') await check();
  else if (command === 'model' && process.argv[3]) await check(process.argv[3]);
  else throw new Error('Use setup, start, login, check, or model MODEL_ID');
} catch (error) {
  // File-system errors can contain private paths; never dump objects or responses.
  console.error(error.code ? 'Gateway setup files or executable are missing/unavailable. Install the pinned binary and run npm run ai:gateway:setup.' : error.message);
  process.exitCode = 1;
}
