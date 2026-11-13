import { createServer } from 'node:https';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Options are per-call seams for bounded negative tests; no global environment mutation.
// Existing callers may continue to supply only the port. External targets acquire nothing.
function normalizePrefix(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('SOF_TEST_PREFIX must be a safe leading/trailing slash URL path');
  if (value === '/') return '';
  const segments = value.split('/');
  if (!value.startsWith('/') || !value.endsWith('/') || segments.slice(1, -1).some(segment => !segment || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/.test(segment))) {
    throw new TypeError('SOF_TEST_PREFIX must be a safe leading/trailing slash URL path');
  }
  return value;
}

export async function productionHarness(port = 4185, {
  env = process.env, tempRoot = tmpdir(), opensslCommand = 'openssl', readCertificate = readFile,
} = {}) {
  const prefix = normalizePrefix(env.SOF_TEST_PREFIX);
  if (env.SOF_TEST_URL) return { base: env.SOF_TEST_URL, local: false, close: async () => {} };
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const built = env.SOF_TEST_DIST || path.join(root, 'dist', 'public');
  const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  const directory = await mkdtemp(path.join(tempRoot, 'sof-https-'));
  let server;
  const sockets = new Set();
  let closing;
  const close = () => closing ||= (async () => {
    try {
      if (server) {
        // Destroy only sockets accepted by this instance, including pending TLS handshakes.
        const stopped = new Promise((resolve, reject) => server.close(error => {
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error); else resolve();
        }));
        for (const socket of sockets) socket.destroy();
        server.closeAllConnections();
        await stopped;
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  })();
  try {
    const key = path.join(directory, 'key.pem'), cert = path.join(directory, 'cert.pem');
    await promisify(execFile)(opensslCommand, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { timeout: 15000, killSignal: 'SIGKILL' });
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
    server = createServer({ key: await readCertificate(key), cert: await readCertificate(cert) }, async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'https://localhost').pathname);
        const artifactPath = prefix && pathname.startsWith(prefix) ? `/${pathname.slice(prefix.length)}` : prefix ? '/' : pathname;
        let target = path.resolve(built, '.' + artifactPath);
        if (!target.startsWith(path.resolve(built) + path.sep)) target = path.join(built, 'index.html');
        try { if (!(await stat(target)).isFile()) target = path.join(built, 'index.html'); } catch { target = path.join(built, 'index.html'); }
        for (const rule of config.headers || []) if (rule.source === '/(.*)') for (const h of rule.headers) response.setHeader(h.key, h.value);
        response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
        response.end(await readFile(target));
      } catch { response.writeHead(500); response.end('Test-server failure'); }
    });
    server.on('connection', socket => {
      sockets.add(socket); socket.once('close', () => sockets.delete(socket));
    });
    await new Promise((resolve, reject) => {
      const failed = error => { server.off('listening', listening); reject(error); };
      const listening = () => { server.off('error', failed); resolve(); };
      server.once('error', failed);
      server.once('listening', listening);
      try { server.listen(port, '127.0.0.1'); } catch (error) {
        server.off('error', failed); server.off('listening', listening); reject(error);
      }
    });
    return { base: `https://127.0.0.1:${server.address().port}${prefix || '/'}`, local: true, close };
  } catch (error) {
    try { await close(); } catch (cleanupError) { error.cleanupError = cleanupError.message; }
    throw error;
  }
}
