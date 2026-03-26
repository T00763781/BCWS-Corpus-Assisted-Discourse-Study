export {};

declare global {
  interface Window {
    openFiresideApi?: {
      incidents: {
        list: (input: unknown) => Promise<unknown>;
        get: (input: unknown) => Promise<unknown>;
        history: (input: unknown) => Promise<unknown>;
        supporting: (input: unknown) => Promise<unknown>;
        updateDiff: (input: unknown) => Promise<unknown>;
      };
      attachments: {
        list: (input: unknown) => Promise<unknown>;
      };
      sync: {
        run: (input: unknown) => Promise<unknown>;
        status: (input: unknown) => Promise<unknown>;
      };
      ingest: {
        diagnostics: () => Promise<unknown>;
        listRuns: (input: unknown) => Promise<unknown>;
        listRawRecords: (input: unknown) => Promise<unknown>;
        getRawRecord: (input: unknown) => Promise<unknown>;
      };
      settings: {
        getPaths: () => Promise<unknown>;
        setDatabasePath: (input: unknown) => Promise<unknown>;
        setStorageRoot: (input: unknown) => Promise<unknown>;
        getIngestConfig: () => Promise<unknown>;
        setIngestConfig: (input: unknown) => Promise<unknown>;
      };
      exports: {
        generateIncidentDossier: (input: unknown) => Promise<unknown>;
      };
    };
  }
}
