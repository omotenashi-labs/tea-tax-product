#!/usr/bin/env bun
/**
 * dev-start — Spins up an ephemeral Postgres container, runs migrations,
 * then starts the API server subprocess and Vite in middleware mode as the
 * single HTTP entry point. Proxies /api through to the API server.
 * Tears down the container on exit.
 *
 * Run via: bun run dev
 */

import { join } from 'path';
import { createServer as createHttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { createServer as createViteServer } from 'vite';
import { startPostgres } from '../packages/db/pg-container';
import { createProxy } from '../apps/web/vite.config';

const REPO_ROOT = join(import.meta.dir, '..');
const WEB_PORT = Number(process.env.PORT ?? 5174);
const API_PORT = WEB_PORT + 1;

async function main() {
  console.log('\n⬡ Starting dev environment');

  // 1. Start ephemeral Postgres
  console.log('  Starting Postgres container...');
  const pg = await startPostgres();
  console.log(`  Postgres ready at: ${pg.url}`);
  process.env.DATABASE_URL = pg.url;
  process.env.AUDIT_DATABASE_URL = pg.url;
  process.env.ANALYTICS_DATABASE_URL = pg.url;

  // 2. Run migrations (dynamic import deferred until env vars are set)
  const { migrate } = await import('../packages/db/index');
  await migrate({ databaseUrl: pg.url });
  console.log('  Schema migrated.');

  // 3. Spawn API server subprocess with all DB URLs set
  const apiServer = Bun.spawn(['bun', 'run', '--hot', 'src/index.ts'], {
    cwd: join(REPO_ROOT, 'apps', 'server'),
    env: {
      ...process.env,
      DATABASE_URL: pg.url,
      AUDIT_DATABASE_URL: pg.url,
      ANALYTICS_DATABASE_URL: pg.url,
      PORT: String(API_PORT),
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  // 4. Create the HTTP server first so Vite can attach its WebSocket upgrade
  //    handler to it. Without this, Vite's HMR WebSocket is never wired to the
  //    server that is actually listening on WEB_PORT, which causes external
  //    browser connections to stall (directSocketHost becomes 'localhost:undefined/').
  const httpServer = createHttpServer();

  // Start Vite in middleware mode — single HTTP entry point, proxies to API.
  // Passing hmr: { server: httpServer } tells Vite to attach its WebSocket
  // upgrade handler to the existing HTTP server instead of opening a second
  // port. HTTP traffic is routed by wiring vite.middlewares as a 'request'
  // listener below.
  const vite = await createViteServer({
    configFile: join(REPO_ROOT, 'apps', 'web', 'vite.config.ts'),
    root: join(REPO_ROOT, 'apps', 'web'),
    server: {
      middlewareMode: true,
      hmr: { server: httpServer },
      proxy: createProxy({ ...process.env, PORT: String(API_PORT) }),
    },
    appType: 'spa',
  });

  httpServer.on('request', vite.middlewares);

  httpServer.listen(WEB_PORT, '0.0.0.0', () => {
    const nets = networkInterfaces();
    const networkIp =
      Object.values(nets)
        .flat()
        .find((n) => n && n.family === 'IPv4' && !n.internal)?.address ?? 'localhost';

    console.log(`\n⬡ Dev server ready`);
    console.log(`  Network: http://${networkIp}:${WEB_PORT}`);
    console.log(`  Local:   http://localhost:${WEB_PORT}`);
    console.log('  Press Ctrl+C to stop\n');
  });

  // 5. Tear down on exit
  const cleanup = async () => {
    console.log('\n⬡ Shutting down');
    apiServer.kill();
    await vite.close();
    httpServer.close();
    await pg.stop();
    console.log('  Done.');
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('\n❌ Dev startup failed.');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
