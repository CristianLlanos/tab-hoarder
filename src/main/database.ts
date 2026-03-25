import Database from 'better-sqlite3'
import { getDbPath } from './storage'
import type { Tab, Collection, CreateTabInput, CreateCollectionInput } from '../shared/types'

let db: Database.Database

export function initDatabase(): void {
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      color       TEXT DEFAULT '#007AFF',
      icon        TEXT DEFAULT '📁',
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tabs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id   INTEGER REFERENCES collections(id) ON DELETE SET NULL,
      url             TEXT NOT NULL,
      title           TEXT NOT NULL DEFAULT '',
      domain          TEXT NOT NULL DEFAULT '',
      thumbnail_path  TEXT,
      favicon_url     TEXT,
      pinned          INTEGER DEFAULT 0,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tabs_collection ON tabs(collection_id);
    CREATE INDEX IF NOT EXISTS idx_tabs_domain ON tabs(domain);
  `)

  // Migration: add profile columns if they don't exist
  const columns = db.prepare(`PRAGMA table_info(tabs)`).all() as Array<{ name: string }>
  const columnNames = columns.map(c => c.name)
  if (!columnNames.includes('chrome_profile_dir')) {
    db.exec(`ALTER TABLE tabs ADD COLUMN chrome_profile_dir TEXT`)
  }
  if (!columnNames.includes('chrome_profile_name')) {
    db.exec(`ALTER TABLE tabs ADD COLUMN chrome_profile_name TEXT`)
  }
  if (!columnNames.includes('notes')) {
    db.exec(`ALTER TABLE tabs ADD COLUMN notes TEXT`)
  }

  // FTS5 virtual table for search
  const ftsExists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='tabs_fts'`
  ).get()

  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE tabs_fts USING fts5(
        title,
        url,
        domain,
        content='tabs',
        content_rowid='id'
      );

      CREATE TRIGGER tabs_ai AFTER INSERT ON tabs BEGIN
        INSERT INTO tabs_fts(rowid, title, url, domain) VALUES (new.id, new.title, new.url, new.domain);
      END;

      CREATE TRIGGER tabs_ad AFTER DELETE ON tabs BEGIN
        INSERT INTO tabs_fts(tabs_fts, rowid, title, url, domain) VALUES ('delete', old.id, old.title, old.url, old.domain);
      END;

      CREATE TRIGGER tabs_au AFTER UPDATE ON tabs BEGIN
        INSERT INTO tabs_fts(tabs_fts, rowid, title, url, domain) VALUES ('delete', old.id, old.title, old.url, old.domain);
        INSERT INTO tabs_fts(rowid, title, url, domain) VALUES (new.id, new.title, new.url, new.domain);
      END;
    `)

    // Populate FTS from existing rows (if any)
    db.exec(`INSERT INTO tabs_fts(rowid, title, url, domain) SELECT id, title, url, domain FROM tabs`)
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ─── Tabs ────────────────────────────────────────────────────

export function getAllTabs(filter?: { collectionId?: number; search?: string }): Tab[] {
  if (filter?.search) {
    return searchTabs(filter.search)
  }

  if (filter?.collectionId) {
    return db.prepare(
      `SELECT * FROM tabs WHERE collection_id = ? ORDER BY pinned DESC, sort_order ASC, created_at DESC`
    ).all(filter.collectionId) as Tab[]
  }

  return db.prepare(
    `SELECT * FROM tabs ORDER BY pinned DESC, sort_order ASC, created_at DESC`
  ).all() as Tab[]
}

export function createTab(input: CreateTabInput): Tab {
  const domain = extractDomain(input.url)
  const favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

  const result = db.prepare(
    `INSERT INTO tabs (url, title, domain, favicon_url, collection_id, chrome_profile_dir, chrome_profile_name) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(input.url, input.title, domain, favicon_url, input.collection_id ?? null, input.chrome_profile_dir ?? null, input.chrome_profile_name ?? null)

  return db.prepare(`SELECT * FROM tabs WHERE id = ?`).get(result.lastInsertRowid) as Tab
}

export function createManyTabs(tabs: CreateTabInput[], collectionId?: number | null): Tab[] {
  const insert = db.prepare(
    `INSERT INTO tabs (url, title, domain, favicon_url, collection_id, chrome_profile_dir, chrome_profile_name) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const insertMany = db.transaction((items: CreateTabInput[]) => {
    const ids: number[] = []
    for (const tab of items) {
      const domain = extractDomain(tab.url)
      const favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      const result = insert.run(tab.url, tab.title, domain, favicon_url, collectionId ?? tab.collection_id ?? null, tab.chrome_profile_dir ?? null, tab.chrome_profile_name ?? null)
      ids.push(Number(result.lastInsertRowid))
    }
    return ids
  })

  const ids = insertMany(tabs)
  const placeholders = ids.map(() => '?').join(',')
  return db.prepare(`SELECT * FROM tabs WHERE id IN (${placeholders}) ORDER BY id`).all(...ids) as Tab[]
}

export function updateTab(id: number, fields: Partial<Tab>): Tab {
  const allowed = ['collection_id', 'url', 'title', 'domain', 'thumbnail_path', 'favicon_url', 'pinned', 'sort_order', 'chrome_profile_dir', 'chrome_profile_name', 'notes']
  const updates: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`)
      values.push(value)
    }
  }

  if (updates.length > 0) {
    updates.push(`updated_at = datetime('now')`)
    values.push(id)
    db.prepare(`UPDATE tabs SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return db.prepare(`SELECT * FROM tabs WHERE id = ?`).get(id) as Tab
}

export function deleteTab(id: number): void {
  db.prepare(`DELETE FROM tabs WHERE id = ?`).run(id)
}

export function searchTabs(query: string): Tab[] {
  const sanitized = query.replace(/['"]/g, '').trim()
  if (!sanitized) return getAllTabs()

  const ftsQuery = sanitized.split(/\s+/).map(term => `"${term}"*`).join(' ')

  return db.prepare(`
    SELECT tabs.* FROM tabs
    JOIN tabs_fts ON tabs.id = tabs_fts.rowid
    WHERE tabs_fts MATCH ?
    ORDER BY rank
  `).all(ftsQuery) as Tab[]
}

// ─── Collections ─────────────────────────────────────────────

export function getAllCollections(): Collection[] {
  return db.prepare(`
    SELECT c.*, COUNT(t.id) as tab_count
    FROM collections c
    LEFT JOIN tabs t ON t.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all() as Collection[]
}

export function createCollection(input: CreateCollectionInput): Collection {
  const result = db.prepare(
    `INSERT INTO collections (name, color, icon) VALUES (?, ?, ?)`
  ).run(input.name, input.color ?? '#007AFF', input.icon ?? '📁')

  return db.prepare(`SELECT *, 0 as tab_count FROM collections WHERE id = ?`).get(result.lastInsertRowid) as Collection
}

export function updateCollection(id: number, fields: Partial<Collection>): Collection {
  const allowed = ['name', 'color', 'icon', 'sort_order']
  const updates: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`)
      values.push(value)
    }
  }

  if (updates.length > 0) {
    updates.push(`updated_at = datetime('now')`)
    values.push(id)
    db.prepare(`UPDATE collections SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return db.prepare(`
    SELECT c.*, COUNT(t.id) as tab_count
    FROM collections c
    LEFT JOIN tabs t ON t.collection_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id) as Collection
}

export function deleteCollection(id: number): void {
  db.prepare(`DELETE FROM collections WHERE id = ?`).run(id)
}

export function getDatabase(): Database.Database {
  return db
}
