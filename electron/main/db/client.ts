import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

class DatabaseManager {
  private db: Database.Database | null = null;
  private orm: BetterSQLite3Database | null = null;
  private currentPath: string | null = null;

  initialize(dbPath: string): void {
    if (this.currentPath === dbPath && this.db && this.orm) {
      return;
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (this.db) {
      this.db.close();
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.orm = drizzle(this.db);
    this.currentPath = dbPath;
    this.runMigrations();
  }

  switchPath(dbPath: string): void {
    this.initialize(dbPath);
  }

  getDb(): Database.Database {
    if (!this.db) throw new Error('Database is not initialized');
    return this.db;
  }

  getOrm(): BetterSQLite3Database {
    if (!this.orm) throw new Error('Database ORM is not initialized');
    return this.orm;
  }

  private runMigrations(): void {
    const db = this.getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const migrationsDir = path.resolve(process.cwd(), 'drizzle', 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const applied = new Set<string>(
      (db.prepare('SELECT name FROM __drizzle_migrations').all() as Array<{ name: string }>).map((row) => row.name)
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      const tx = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO __drizzle_migrations(name) VALUES (?)').run(file);
      });
      tx();
    }
  }
}

export const databaseManager = new DatabaseManager();

