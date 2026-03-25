export type EntityType = 'user' | 'task' | 'tag' | 'github_link' | 'channel' | 'message';

export interface Entity {
  id: string;
  type: EntityType;
  properties: Record<string, unknown>;
  tenant_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Relation {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
}

// Tea Tax semantic properties mapped from the Entity JSONB
// Policy note: this app stores password hashes inside the generic user
// entity payload. The target blueprint posture replaces this with passkey-first
// auth, dedicated auth/audit controls, and stricter separation between identity
// material and general business entities.
export interface UserProperties {
  username: string;
  password_hash: string;
}

export interface GithubLinkProperties {
  issueNumber: number;
  repository: string;
  status: 'open' | 'closed';
  url: string;
}

// ---------------------------------------------------------------------------
// JSON Schemas for server-side validation and integration test fixtures
// ---------------------------------------------------------------------------

/** JSON Schema for user registration (POST /api/auth/register body). */
export const registerUserSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 6 },
  },
  required: ['username', 'password'],
  additionalProperties: false,
} as const;

/** JSON Schema for user login (POST /api/auth/login body). */
export const loginUserSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
  required: ['username', 'password'],
  additionalProperties: false,
} as const;
