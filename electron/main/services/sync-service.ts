import { ingestEngine } from './ingest/sync-engine';

type SyncScope = 'list' | 'detail' | 'full';

type SyncRun = {
  runId: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  mode: 'manual';
  scope: SyncScope;
  summary?: Record<string, unknown> | null;
  error?: string | null;
};

class SyncService {
  private currentRun: SyncRun | null = null;
  private lastRun: SyncRun | null = null;

  async run(scope: SyncScope = 'full'): Promise<{ runId: string }> {
    if (this.currentRun) {
      return { runId: this.currentRun.runId };
    }

    const start = {
      runId: `run-${Date.now()}`,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'running' as const,
      mode: 'manual' as const,
      scope,
      summary: null,
      error: null,
    };

    this.currentRun = start;
    this.lastRun = start;

    ingestEngine
      .run(scope, 'manual', start.runId)
      .then((result) => {
        const completed: SyncRun = {
          runId: start.runId,
          startedAt: start.startedAt,
          endedAt: new Date().toISOString(),
          status: 'completed',
          mode: 'manual',
          scope,
          summary: result.summary,
          error: null,
        };
        this.lastRun = completed;
        this.currentRun = null;
      })
      .catch((error: unknown) => {
        const failed: SyncRun = {
          runId: start.runId,
          startedAt: start.startedAt,
          endedAt: new Date().toISOString(),
          status: 'failed',
          mode: 'manual',
          scope,
          summary: null,
          error: error instanceof Error ? error.message : String(error),
        };
        this.lastRun = failed;
        this.currentRun = null;
      });

    return { runId: start.runId };
  }

  status(runId?: string): { currentRun: SyncRun | null; lastRun: SyncRun | null; queueStats: { pending: number } } {
    const selectedLast = runId && this.lastRun?.runId === runId ? this.lastRun : this.lastRun;
    return {
      currentRun: this.currentRun,
      lastRun: selectedLast || null,
      queueStats: { pending: this.currentRun ? 1 : 0 },
    };
  }
}

export const syncService = new SyncService();
