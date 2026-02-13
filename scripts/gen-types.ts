/**
 * Generate Supabase TypeScript types from the live database.
 *
 * Strategy (in order of preference):
 * 1. `supabase gen types typescript --linked` (requires `npx supabase login`)
 * 2. PostgREST OpenAPI introspection via service role key (always works)
 *
 * Usage:
 *   npx tsx scripts/gen-types.ts
 *   # or via npm script:
 *   npm run gen:types
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const OUT_PATH = resolve(ROOT, 'src/types/database.ts');

// ---------------------------------------------------------------------------
// Strategy 1: Supabase CLI (preferred — full fidelity including enums, funcs)
// ---------------------------------------------------------------------------
function trySupabaseCli(): boolean {
  try {
    console.log('Trying: supabase gen types typescript --linked ...');
    const result = execFileSync(
      'npx',
      ['supabase', 'gen', 'types', 'typescript', '--linked', '--schema', 'public'],
      { cwd: ROOT, timeout: 30_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (result && result.includes('export type Database')) {
      writeFileSync(OUT_PATH, result);
      console.log(`Written ${OUT_PATH} via Supabase CLI`);
      return true;
    }
  } catch {
    console.log('Supabase CLI not authenticated or not available, falling back to OpenAPI...');
  }
  return false;
}

// ---------------------------------------------------------------------------
// Strategy 2: PostgREST OpenAPI introspection (always works with service key)
// ---------------------------------------------------------------------------
function loadEnv(): Record<string, string> {
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) {
    throw new Error('.env.local not found');
  }
  const content = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function mapType(prop: Record<string, unknown>): string {
  if (!prop) return 'unknown';

  if (prop.anyOf) {
    const types = (prop.anyOf as Record<string, unknown>[])
      .map((t) => mapType(t))
      .filter((t) => t !== 'unknown');
    return types.length > 0 ? types.join(' | ') : 'unknown';
  }

  const format = prop.format as string | undefined;
  const type = prop.type as string | undefined;

  if (prop.enum) {
    return (prop.enum as string[]).map((v) => JSON.stringify(v)).join(' | ');
  }

  if (type === 'array') {
    if (prop.items) return `${mapType(prop.items as Record<string, unknown>)}[]`;
    return 'unknown[]';
  }

  if (type === 'object' || format === 'jsonb' || format === 'json') return 'Json';
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'string') return 'string';

  return 'string';
}

interface TableTypes {
  Row: string;
  Insert: string;
  Update: string;
}

function buildTableTypes(def: Record<string, unknown>): TableTypes {
  const props = (def.properties || {}) as Record<string, Record<string, unknown>>;
  const required = new Set((def.required || []) as string[]);

  const row: string[] = [];
  const insert: string[] = [];
  const update: string[] = [];

  for (const [col, colDef] of Object.entries(props)) {
    const tsType = mapType(colDef);
    const desc = (colDef.description || '') as string;
    const hasDefault =
      desc.includes('default') || desc.includes('Note:') || colDef.default !== undefined;
    const isReq = required.has(col);

    // Row: all fields present
    row.push(`          ${col}: ${isReq ? tsType : `${tsType} | null`}`);

    // Insert: required (no default) are required, rest optional
    if (isReq && !hasDefault) {
      insert.push(`          ${col}: ${tsType}`);
    } else if (!isReq) {
      insert.push(`          ${col}?: ${tsType} | null`);
    } else {
      insert.push(`          ${col}?: ${tsType}`);
    }

    // Update: all optional
    update.push(`          ${col}?: ${isReq ? tsType : `${tsType} | null`}`);
  }

  return { Row: row.join('\n'), Insert: insert.join('\n'), Update: update.join('\n') };
}

async function tryOpenApi(): Promise<boolean> {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    return false;
  }

  console.log('Fetching PostgREST OpenAPI spec...');
  const resp = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!resp.ok) {
    console.error(`Failed: ${resp.status} ${resp.statusText}`);
    return false;
  }

  const spec = (await resp.json()) as {
    definitions?: Record<string, Record<string, unknown>>;
  };
  const defs = spec.definitions || {};
  console.log(`Found ${Object.keys(defs).length} tables`);

  const tableEntries: string[] = [];
  for (const [name, def] of Object.entries(defs).sort(([a], [b]) => a.localeCompare(b))) {
    const t = buildTableTypes(def);
    tableEntries.push(`      ${name}: {
        Row: {
${t.Row}
        }
        Insert: {
${t.Insert}
        }
        Update: {
${t.Update}
        }
        Relationships: []
      }`);
  }

  const output = `// =============================================================================
// AUTO-GENERATED Supabase Database Types
// Generated from PostgREST OpenAPI spec — ${new Date().toISOString().slice(0, 10)}
//
// To regenerate: npm run gen:types
//
// For full fidelity (enums, composite types, functions), authenticate the
// Supabase CLI first:
//   npx supabase login
//   npm run gen:types
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
${tableEntries.join('\n')}
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// =============================================================================
// Helper types
// =============================================================================

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
`;

  writeFileSync(OUT_PATH, output);
  console.log(`Written ${OUT_PATH} via OpenAPI introspection`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (trySupabaseCli()) return;
  if (await tryOpenApi()) return;
  console.error('Failed to generate types. See errors above.');
  process.exit(1);
}

main();
