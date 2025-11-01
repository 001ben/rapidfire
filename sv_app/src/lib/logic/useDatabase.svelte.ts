import { DataManager, exampleDatasets, type Dataset } from "$lib/logic/data";
import { XQL, F } from "$lib/xql";

export function useDatabase(initialDataset: Dataset) {
  let db: DataManager;
  let isDbReady = $state(false)
  let dbError = $state<string | null>(null);
  let isLoading = $state(false);

  async function initialise() {
    try {
      db = await DataManager.create();
      let query = await importDataset(initialDataset);
      isDbReady = true;
      return query;
    } catch (e) {
      console.error("Database initialization error:", e);
      dbError = e instanceof Error ? e.message : String(e);
    }
  }

  async function importDataset(dataset: Dataset) {
    console.log("importing", dataset.name)
    if (!db) return;
    isLoading = true;
    try {
      await db.importDataset(dataset);
      return XQL.from(dataset.name).toString();
    } catch (e) {
      console.error("Import error:", e);
      throw e; // Let caller handle UI error
    } finally {
      isLoading = false;
    }
  }

  async function loadCustomUrl(url: string) {
    if (!db || !url) return;
    let customDataset = db.resolveUrlToDataset(url);
    return await importDataset(customDataset);
  }

  return {
    // State getters
    get isDbReady() { return isDbReady },
    get dbError() { return dbError },
    get isLoading() { return isLoading },
    get instance() { return db },
    // Methods
    initialise,
    importDataset,
    loadCustomUrl,
  }
}