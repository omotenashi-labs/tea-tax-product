import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const FIXTURE_PORT = Number(process.env.COMPONENT_FIXTURE_PORT ?? 40123);
const STATE_PATH = join(new URL('.', import.meta.url).pathname, '.runtime', 'fixture-state.json');

function ensureStateFile() {
  const parent = dirname(STATE_PATH);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({}, null, 2));
}

async function nodeRequestToWebRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const url = `http://127.0.0.1:${FIXTURE_PORT}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
  }

  return new Request(url, {
    method: req.method ?? 'GET',
    headers,
    body: body && body.length > 0 ? body : undefined,
  });
}

export default async function setup() {
  ensureStateFile();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const webReq = await nodeRequestToWebRequest(req);
      const { handleFixtureRequest } = await import('./fixture-server');
      const webRes = await handleFixtureRequest(webReq, STATE_PATH);

      res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
      const body = await webRes.text();
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(FIXTURE_PORT, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(STATE_PATH, { force: true });
  };
}
