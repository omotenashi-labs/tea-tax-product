import { existsSync, readFileSync } from 'fs';

type FixtureTask = {
  id: string;
  name: string;
  description: string;
  owner: string;
  priority: string;
  status: string;
  estimatedDeliver: string | null;
  estimateStart: string | null;
  dependsOn: string[];
  tags: string[];
  createdAt: string;
};

type FixtureState = {
  tasks?: FixtureTask[];
};

type FixtureStore = Record<string, FixtureState>;

function loadState(path: string): FixtureStore {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as FixtureStore;
  } catch {
    return {};
  }
}

export async function handleFixtureRequest(req: Request, statePath: string): Promise<Response> {
  const url = new URL(req.url);
  const store = loadState(statePath);
  const fixtureId = url.searchParams.get('fixtureId') ?? 'default';
  const state = store[fixtureId] ?? {};

  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    return json(state.tasks ?? []);
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const body = (await req.json()) as Record<string, unknown>;
    const created = {
      id: 'task-new',
      name: String(body.name ?? 'New task'),
      description: String(body.description ?? ''),
      owner: String(body.owner ?? ''),
      priority: String(body.priority ?? 'low'),
      status: 'todo',
      estimatedDeliver: null,
      estimateStart: null,
      dependsOn: [],
      tags: [],
      createdAt: new Date().toISOString(),
    } satisfies FixtureTask;
    return json(created);
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/tasks/')) {
    const body = (await req.json()) as Record<string, unknown>;
    return json({
      id: url.pathname.split('/').at(-1) ?? 'task-1',
      name: String(body.name ?? 'Task'),
      description: String(body.description ?? ''),
      owner: String(body.owner ?? ''),
      priority: String(body.priority ?? 'low'),
      status: String(body.status ?? 'todo'),
      estimatedDeliver: null,
      estimateStart: null,
      dependsOn: [],
      tags: [],
      createdAt: new Date().toISOString(),
    });
  }

  return new Response(
    JSON.stringify({ error: `Unhandled fixture route ${req.method} ${url.pathname}` }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
