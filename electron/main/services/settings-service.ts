import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { databaseManager } from '../db/client';

type AppPaths = {
  dbPath: string;
  storageRoot: string;
  backupPath: string | null;
  lastValidatedAt: string | null;
};

type IngestConfig = {
  detailTargetLimit: number;
  playwrightFallbackBudget: number;
};

const DB_FILENAME = 'openfireside.db';
const SETTINGS_FILENAME = 'settings.json';

class SettingsService {
  private ensureBaseDir(): string {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const baseDir = path.join(localAppData, 'OpenFireside');
    fs.mkdirSync(baseDir, { recursive: true });
    return baseDir;
  }

  private settingsPath(): string {
    return path.join(this.ensureBaseDir(), SETTINGS_FILENAME);
  }

  private defaultPaths(): AppPaths {
    const baseDir = this.ensureBaseDir();
    return {
      dbPath: path.join(baseDir, DB_FILENAME),
      storageRoot: path.join(baseDir, 'storage'),
      backupPath: null,
      lastValidatedAt: null,
    };
  }

  private defaultIngestConfig(): IngestConfig {
    return {
      detailTargetLimit: 150,
      playwrightFallbackBudget: 5,
    };
  }

  getPaths(): AppPaths {
    const defaults = this.defaultPaths();
    const settingsPath = this.settingsPath();

    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(defaults.storageRoot, { recursive: true });
      this.savePaths(defaults);
      return defaults;
    }

    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Partial<AppPaths>;
    const paths: AppPaths = {
      dbPath: raw.dbPath || defaults.dbPath,
      storageRoot: raw.storageRoot || defaults.storageRoot,
      backupPath: raw.backupPath ?? null,
      lastValidatedAt: raw.lastValidatedAt ?? null,
    };

    fs.mkdirSync(path.dirname(paths.dbPath), { recursive: true });
    fs.mkdirSync(paths.storageRoot, { recursive: true });
    this.savePaths(paths);
    return paths;
  }

  getIngestConfig(): IngestConfig {
    const settingsPath = this.settingsPath();
    const defaults = this.defaultIngestConfig();
    if (!fs.existsSync(settingsPath)) {
      this.getPaths();
    }
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
      ingestConfig?: Partial<IngestConfig>;
    };
    const next: IngestConfig = {
      detailTargetLimit: Number(raw.ingestConfig?.detailTargetLimit ?? defaults.detailTargetLimit),
      playwrightFallbackBudget: Number(raw.ingestConfig?.playwrightFallbackBudget ?? defaults.playwrightFallbackBudget),
    };
    this.saveIngestConfig(next);
    return next;
  }

  setIngestConfig(input: Partial<IngestConfig>): IngestConfig {
    const current = this.getIngestConfig();
    const next: IngestConfig = {
      detailTargetLimit: Math.max(1, Math.min(1000, Number(input.detailTargetLimit ?? current.detailTargetLimit))),
      playwrightFallbackBudget: Math.max(0, Math.min(50, Number(input.playwrightFallbackBudget ?? current.playwrightFallbackBudget))),
    };
    this.saveIngestConfig(next);
    return next;
  }

  setDatabasePath(newPath: string): AppPaths {
    const current = this.getPaths();
    const target = path.resolve(newPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    if (fs.existsSync(current.dbPath) && current.dbPath !== target) {
      fs.copyFileSync(current.dbPath, target);
    }

    this.validateDatabase(target);

    const next: AppPaths = {
      ...current,
      dbPath: target,
      backupPath: current.dbPath === target ? current.backupPath : current.dbPath,
      lastValidatedAt: new Date().toISOString(),
    };

    this.savePaths(next);
    databaseManager.switchPath(target);
    return next;
  }

  setStorageRoot(newPath: string): AppPaths {
    const current = this.getPaths();
    const target = path.resolve(newPath);
    fs.mkdirSync(target, { recursive: true });

    if (current.storageRoot !== target && fs.existsSync(current.storageRoot)) {
      fs.cpSync(current.storageRoot, target, { recursive: true, force: true });
    }

    const next: AppPaths = {
      ...current,
      storageRoot: target,
      backupPath: current.storageRoot === target ? current.backupPath : current.storageRoot,
      lastValidatedAt: new Date().toISOString(),
    };

    this.savePaths(next);
    return next;
  }

  private validateDatabase(dbPath: string): void {
    const db = new Database(dbPath);
    try {
      const quickCheck = db.pragma('quick_check', { simple: true });
      if (String(quickCheck).toLowerCase() !== 'ok') {
        throw new Error(`SQLite quick_check failed: ${String(quickCheck)}`);
      }
    } finally {
      db.close();
    }
  }

  private savePaths(paths: AppPaths): void {
    const current = this.readSettingsObject();
    const next = { ...current, ...paths };
    fs.writeFileSync(this.settingsPath(), JSON.stringify(next, null, 2), 'utf-8');
  }

  private saveIngestConfig(config: IngestConfig): void {
    const current = this.readSettingsObject();
    const next = { ...current, ingestConfig: config };
    fs.writeFileSync(this.settingsPath(), JSON.stringify(next, null, 2), 'utf-8');
  }

  private readSettingsObject(): Record<string, unknown> {
    const settingsPath = this.settingsPath();
    if (!fs.existsSync(settingsPath)) return {};
    try {
      const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }
}

export const settingsService = new SettingsService();
export type { AppPaths, IngestConfig };
