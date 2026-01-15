#!/usr/bin/env npx ts-node
/**
 * Syncs SQL queries from docs/metabase-*.md files to Metabase
 * 
 * Usage:
 *   npx tsx scripts/metabase-sync.ts --list          # List existing Metabase cards
 *   npx tsx scripts/metabase-sync.ts --sync          # Create/update cards from markdown
 *   npx tsx scripts/metabase-sync.ts --dry-run       # Preview what would be created
 * 
 * Reads from:
 *   - docs/metabase-kpis.md (KPI single-value cards)
 *   - docs/metabase-detail.md (trends, funnels, drilldowns)
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
const MARKDOWN_PATHS = [
  path.join(__dirname, '../docs/metabase-kpis.md'),
  path.join(__dirname, '../docs/metabase-detail.md'),
];

// No prefix needed - Metabase is KH-only

// Batching config to prevent overwhelming Metabase/Railway
// Conservative settings after Railway rate limit issues (500 logs/sec)
const BATCH_SIZE = 3;           // Cards per batch (reduced from 5)
const BATCH_DELAY_MS = 10000;   // 10 seconds between batches (increased from 3)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  const queries: ParsedQuery[] = [];
  
  for (const markdownPath of MARKDOWN_PATHS) {
    if (!fs.existsSync(markdownPath)) {
      console.warn(`Warning: ${markdownPath} not found, skipping`);
      continue;
    }
    const content = fs.readFileSync(markdownPath, 'utf-8');
    const fileQueries = parseFileQueries(content, markdownPath);
    queries.push(...fileQueries);
  }
  
  return queries;
}

function parseFileQueries(content: string, sourcePath: string): ParsedQuery[] {
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

function getSourceDescription(sourcePath: string): string {
  const filename = path.basename(sourcePath);
  return filename.replace('.md', '');
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
      // Calculate default dates (last 28 days)
      const today = new Date();
      const twentyEightDaysAgo = new Date(today);
      twentyEightDaysAgo.setDate(today.getDate() - 28);
      
      let defaultValue: string | null = null;
      if (varName === 'days_back') {
        defaultValue = '28';
      } else if (varName === 'start_date') {
        defaultValue = twentyEightDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (varName === 'end_date') {
        defaultValue = today.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      
      tags[varName] = {
        id: crypto.randomUUID(),
        name: varName,
        'display-name': varName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type: varName.includes('date') ? 'date' : 'number',
        default: defaultValue,
      };
    }
  }
  
  return tags;
}

async function createCard(query: ParsedQuery, databaseId: number): Promise<MetabaseCard> {
  const templateTags = buildTemplateTags(query.sql);
  
  const payload = {
    name: query.name,
    description: query.comment || `Query: ${query.section}`,
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

async function updateCard(cardId: number, query: ParsedQuery, databaseId: number): Promise<MetabaseCard> {
  const templateTags = buildTemplateTags(query.sql);
  
  const payload = {
    name: query.name,
    description: query.comment || `Query: ${query.section}`,
    dataset_query: {
      type: 'native',
      native: {
        query: query.sql,
        'template-tags': templateTags,
      },
      database: databaseId,
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
        console.log(`Found ${queries.length} queries in ${MARKDOWN_PATHS.length} files\n`);
        
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
        
        // Process in batches to prevent overwhelming Metabase/Railway
        for (let i = 0; i < queries.length; i += BATCH_SIZE) {
          const batch = queries.slice(i, i + BATCH_SIZE);
          
          // Process batch
          for (const query of batch) {
            const existing = cardsByName.get(query.name);
            
            if (existing) {
              console.log(`🔄 Updating: ${query.name}`);
              await updateCard(existing.id, query, databaseId);
              updated++;
            } else {
              console.log(`✨ Creating: ${query.name}`);
              await createCard(query, databaseId);
              created++;
            }
          }
          
          // Delay between batches (except after last batch)
          if (i + BATCH_SIZE < queries.length) {
            const remaining = queries.length - i - BATCH_SIZE;
            console.log(`   ⏳ Waiting ${BATCH_DELAY_MS/1000}s before next batch (${remaining} remaining)...`);
            await sleep(BATCH_DELAY_MS);
          }
        }
        
        console.log(`\nDone! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
        break;
      }
      
      case '--cleanup': {
        // Force-clean stale template tags from all cards
        console.log('Cleaning stale template tags from all cards...\n');
        
        const queries = parseMarkdownQueries();
        const queryByName = new Map(queries.map(q => [q.name, q]));
        const existingCards = await listExistingCards();
        const databaseId = await getDatabaseId();
        
        let cleaned = 0;
        for (let i = 0; i < existingCards.length; i += BATCH_SIZE) {
          const batch = existingCards.slice(i, i + BATCH_SIZE);
          
          for (const card of batch) {
            const query = queryByName.get(card.name);
            if (!query) {
              console.log(`⏭️  Skipping: ${card.name} (not in markdown)`);
              continue;
            }
            
            // Build fresh template tags from current SQL
            const freshTags = buildTemplateTags(query.sql);
            
            // Update card with completely fresh template-tags
            console.log(`🧹 Cleaning: ${card.name} → tags: [${Object.keys(freshTags).join(', ')}]`);
            
            await metabaseRequest(`/api/card/${card.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                dataset_query: {
                  type: 'native',
                  native: {
                    query: query.sql,
                    'template-tags': freshTags,
                  },
                  database: databaseId,
                },
              }),
            });
            cleaned++;
          }
          
          if (i + BATCH_SIZE < existingCards.length) {
            const remaining = existingCards.length - i - BATCH_SIZE;
            console.log(`   ⏳ Waiting ${BATCH_DELAY_MS/1000}s before next batch (${remaining} remaining)...`);
            await sleep(BATCH_DELAY_MS);
          }
        }
        
        console.log(`\nDone! Cleaned ${cleaned} cards.`);
        break;
      }
      
      case '--help':
      default:
        console.log(`
Metabase Query Sync Tool

Usage:
  npx tsx scripts/metabase-sync.ts <command>

Commands:
  --list      List existing Metabase cards
  --dry-run   Preview queries that would be created/updated
  --sync      Create/update cards from docs/metabase-*.md files
  --cleanup   Force-clean stale template tags from all cards
  --help      Show this help message

Queries use section headers from metabase-kpis.md and metabase-detail.md as names.
        `);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
