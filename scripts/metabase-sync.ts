#!/usr/bin/env npx ts-node
/**
 * Syncs SQL queries from docs/metabase-dashboard.md to Metabase
 * 
 * Usage:
 *   npx ts-node scripts/metabase-sync.ts --list          # List existing Metabase cards
 *   npx ts-node scripts/metabase-sync.ts --sync          # Create/update cards from markdown
 *   npx ts-node scripts/metabase-sync.ts --dry-run       # Preview what would be created
 * 
 * Requires METABASE_API_KEY in .env.local
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local explicitly
config({ path: path.join(__dirname, '../.env.local') });

const METABASE_URL = 'https://metabase-production-c3d3.up.railway.app';
const METABASE_API_KEY = process.env.METABASE_API_KEY;
const MARKDOWN_PATH = path.join(__dirname, '../docs/metabase-dashboard.md');

// No prefix needed - Metabase is KH-only

interface ParsedQuery {
  name: string;
  section: string;
  sql: string;
  comment?: string;
}

interface MetabaseCard {
  id: number;
  name: string;
  description?: string;
  display: string;
  dataset_query: {
    type: string;
    native?: {
      query: string;
      template_tags?: Record<string, unknown>;
    };
    database: number;
  };
}

async function metabaseRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${METABASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': METABASE_API_KEY!,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Metabase API error: ${res.status} ${res.statusText} - ${text}`);
  }
  
  return res.json();
}

function parseMarkdownQueries(): ParsedQuery[] {
  const content = fs.readFileSync(MARKDOWN_PATH, 'utf-8');
  const queries: ParsedQuery[] = [];
  
  // Match ### headers followed by ```sql blocks
  const sectionRegex = /^###\s+(.+?)$/gm;
  const sqlBlockRegex = /```sql\n([\s\S]*?)```/g;
  
  let currentSection = '';
  let lastIndex = 0;
  
  // Find all sections and their SQL blocks
  const lines = content.split('\n');
  let inSqlBlock = false;
  let currentSql = '';
  let currentComment = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track section headers (### level)
    if (line.startsWith('### ')) {
      currentSection = line.replace(/^###\s+/, '').trim();
    }
    
    // Track SQL blocks
    if (line.startsWith('```sql')) {
      inSqlBlock = true;
      currentSql = '';
      currentComment = '';
      continue;
    }
    
    if (line === '```' && inSqlBlock) {
      inSqlBlock = false;
      
      // Extract comment from first lines of SQL
      const sqlLines = currentSql.trim().split('\n');
      const commentLines: string[] = [];
      for (const sqlLine of sqlLines) {
        if (sqlLine.startsWith('--')) {
          commentLines.push(sqlLine.replace(/^--\s*/, ''));
        } else {
          break;
        }
      }
      
      if (currentSection && currentSql.trim()) {
        queries.push({
          name: currentSection,
          section: currentSection,
          sql: currentSql.trim(),
          comment: commentLines.join(' ') || undefined,
        });
      }
      continue;
    }
    
    if (inSqlBlock) {
      currentSql += line + '\n';
    }
  }
  
  return queries;
}

async function listExistingCards(): Promise<MetabaseCard[]> {
  const cards = await metabaseRequest('/api/card') as MetabaseCard[];
  return cards;
}

async function getDatabaseId(): Promise<number> {
  const response = await metabaseRequest('/api/database') as { data: { id: number; name: string }[] };
  const databases = response.data;
  // Find the Supabase/PostgreSQL database (not sample)
  const db = databases.find(d => 
    d.name.toLowerCase().includes('supabase') || 
    d.name.toLowerCase().includes('postgres') ||
    d.name.toLowerCase().includes('kaufmann')
  );
  if (!db) {
    console.log('Available databases:', databases.map(d => `${d.id}: ${d.name}`));
    throw new Error('Could not find Supabase database. Please specify database ID manually.');
  }
  return db.id;
}

function buildTemplateTags(sql: string): Record<string, unknown> {
  const tags: Record<string, unknown> = {};
  
  // Find all {{variable}} patterns
  const varRegex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = varRegex.exec(sql)) !== null) {
    const varName = match[1];
    if (!tags[varName]) {
      tags[varName] = {
        id: crypto.randomUUID(),
        name: varName,
        'display-name': varName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type: varName.includes('date') ? 'date' : 'number',
        default: varName === 'days_back' ? '28' : null,
      };
    }
  }
  
  return tags;
}

async function createCard(query: ParsedQuery, databaseId: number): Promise<MetabaseCard> {
  const templateTags = buildTemplateTags(query.sql);
  
  const payload = {
    name: query.name,
    description: query.comment || `Query from metabase-dashboard.md: ${query.section}`,
    display: 'table',
    visualization_settings: {},
    dataset_query: {
      type: 'native',
      native: {
        query: query.sql,
        'template-tags': templateTags,
      },
      database: databaseId,
    },
    collection_id: null, // Root collection, can be changed
  };
  
  const card = await metabaseRequest('/api/card', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as MetabaseCard;
  
  return card;
}

async function updateCard(cardId: number, query: ParsedQuery): Promise<MetabaseCard> {
  const templateTags = buildTemplateTags(query.sql);
  
  const payload = {
    name: query.name,
    description: query.comment || `Query from metabase-dashboard.md: ${query.section}`,
    dataset_query: {
      type: 'native',
      native: {
        query: query.sql,
        'template-tags': templateTags,
      },
    },
  };
  
  const card = await metabaseRequest(`/api/card/${cardId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as MetabaseCard;
  
  return card;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--help';
  
  if (!METABASE_API_KEY) {
    console.error('Error: METABASE_API_KEY not found in environment');
    console.error('Add it to .env.local: METABASE_API_KEY="mb_..."');
    process.exit(1);
  }
  
  try {
    switch (command) {
      case '--list': {
        console.log('Fetching existing Metabase cards...\n');
        const cards = await listExistingCards();
        
        console.log(`Found ${cards.length} cards:\n`);
        for (const card of cards) {
          console.log(`  [${card.id}] ${card.name}`);
        }
        break;
      }
      
      case '--dry-run':
      case '--sync': {
        const dryRun = command === '--dry-run';
        console.log(dryRun ? 'DRY RUN - no changes will be made\n' : 'Syncing queries to Metabase...\n');
        
        // Parse markdown
        const queries = parseMarkdownQueries();
        console.log(`Found ${queries.length} queries in ${MARKDOWN_PATH}\n`);
        
        if (dryRun) {
          for (const q of queries) {
            console.log(`📝 ${q.name}`);
            if (q.comment) console.log(`   ${q.comment}`);
          }
          break;
        }
        
        // Get database ID
        const databaseId = await getDatabaseId();
        console.log(`Using database ID: ${databaseId}\n`);
        
        // Get existing cards
        const existingCards = await listExistingCards();
        const cardsByName = new Map(existingCards.map(c => [c.name, c]));
        
        let created = 0;
        let updated = 0;
        let skipped = 0;
        
        for (const query of queries) {
          const existing = cardsByName.get(query.name);
          
          if (existing) {
            // Update existing card
            console.log(`🔄 Updating: ${query.name}`);
            await updateCard(existing.id, query);
            updated++;
          } else {
            // Create new card
            console.log(`✨ Creating: ${query.name}`);
            await createCard(query, databaseId);
            created++;
          }
        }
        
        console.log(`\nDone! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
        break;
      }
      
      case '--help':
      default:
        console.log(`
Metabase Query Sync Tool

Usage:
  npx ts-node scripts/metabase-sync.ts <command>

Commands:
  --list      List existing Metabase cards
  --dry-run   Preview queries that would be created/updated
  --sync      Create/update cards from docs/metabase-dashboard.md
  --help      Show this help message

Queries use section headers from metabase-dashboard.md as names.
        `);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
