import path from 'node:path';
import { settingsService } from '../services/settings-service';
import { databaseManager } from './client';

function run(): void {
  const paths = settingsService.getPaths();
  databaseManager.initialize(paths.dbPath);
  console.log(`Migrations applied on ${paths.dbPath}`);
}

run();
