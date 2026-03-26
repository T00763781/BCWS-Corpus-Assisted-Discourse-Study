import { settingsService } from '../services/settings-service';
import { databaseManager } from './client';
import { incidentsRepository } from './repositories/incidents-repo';

function run(): void {
  const paths = settingsService.getPaths();
  databaseManager.initialize(paths.dbPath);
  incidentsRepository.seedIfEmpty();
  console.log(`Seed completed for ${paths.dbPath}`);
}

run();
