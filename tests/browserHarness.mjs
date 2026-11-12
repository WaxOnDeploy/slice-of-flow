import { createServer } from 'node:https';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function productionHarness(port = 4185) {
  if (process.env.SOF_TEST_URL) return { base: process.env.SOF_TEST_URL, local: false, close: async () => {} };
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const built = process.env.SOF_TEST_DIST || path.join(root, 'dist', 'public');
  const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  const directory = await mkdtemp(path.join(tmpdir(), 'sof-https-'));
  const key = path.join(directory, 'key.pem'), cert = path.join(directory, 'cert.pem');
  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1']);
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
  const server = createServer({ key: await readFile(key), cert: await readFile(cert) }, async (request, response) => {
    try {
      let target = path.resolve(built, '.' + decodeURIComponent(new URL(request.url, 'https://localhost').pathname));
      if (!target.startsWith(path.resolve(built) + path.sep)) target = path.join(built, 'index.html');
      try { if (!(await stat(target)).isFile()) target = path.join(built, 'index.html'); } catch { target = path.join(built, 'index.html'); }
      for (const rule of config.headers || []) if (rule.source === '/(.*)') for (const h of rule.headers) response.setHeader(h.key, h.value);
      response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
      response.end(await readFile(target));
    } catch { response.writeHead(500); response.end('Test-server failure'); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { base: `https://127.0.0.1:${port}/`, local: true, close: async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); } };
}
