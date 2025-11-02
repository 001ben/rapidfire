import type { Dataset } from "$lib/logic/types";

const MOSAIC_DATA_URL =
  "https://raw.githubusercontent.com/uwdata/mosaic/main/data/";

export const exampleDatasets: Dataset[] = [
  {
    name: "penguins",
    url: "https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv",
    type: "csv",
  },
  {
    name: "pokemon",
    url: "https://gist.githubusercontent.com/armgilles/194bcff35001e7eb53a2a8b441e8b2c6/raw/92200bc0a673d5ce2110aaad4544ed6c4010f687/pokemon.csv",
    type: "csv",
  },
  { name: "athletes", url: `${MOSAIC_DATA_URL}athletes.csv`, type: "csv" },
  {
    name: "seattle_weather",
    url: `${MOSAIC_DATA_URL}seattle-weather.csv`,
    type: "csv",
  },
  {
    name: "latency",
    url: "https://pub-1da360b43ceb401c809f68ca37c7f8a4.r2.dev/data/observable-latency.parquet",
    type: "parquet",
  },
  // Can't link to google drive files directly due to CORS
  // {
  //   name: "lol25",
  //   url: "https://drive.google.com/uc?export=download&id=1v6LRphp2kYciU4SXp0PCjEMuev1bDejc",
  //   type: "csv",
  // }
];

export async function import_vg_aq() {
  let vg = await import("@uwdata/vgplot");
  let aq = await import("arquero");
  return {vg, aq};
}

export class DataManager {
  vg: any;
  aq: any;
  duckdb: any;
  
  private static instance: DataManager | null = null;
  private static creationPromise: Promise<DataManager> | null = null;

  private constructor(vg: any, aq: any, duckdb: any) {
    this.vg = vg;
    this.aq = aq;
    this.duckdb = duckdb;
    console.log("DataManager instance created.");
  }

  public static create(): Promise<DataManager> {
    if(DataManager.instance) {
      return Promise.resolve(DataManager.instance);
    }

    if (DataManager.creationPromise) {
      return DataManager.creationPromise;
    }

    // 3. This is the first call. Start the async creation.
    DataManager.creationPromise = (async () => {
      try {
        const { vg, aq } = await import_vg_aq();
        vg.coordinator().databaseConnector(vg.wasmConnector());
        const duckdb = await vg.coordinator().manager.db.getDuckDB();

        // Create the instance and store it
        const newInstance = new DataManager(vg, aq, duckdb);
        DataManager.instance = newInstance;
        
        // Clear the promise holder
        DataManager.creationPromise = null;
        
        return newInstance;
      } catch (error) {
        // Clear the promise holder on failure so we can try again
        DataManager.creationPromise = null;
        console.error("Database initialization error in DataManager:", error);
        throw error;
      }
    })();

    return DataManager.creationPromise;
  }

  async importDataset(dataset: Dataset): Promise<void> {
    const vg = this.vg;
    const creationQuery = 
      dataset.type === "parquet" 
      ? vg.loadParquet(dataset.name, dataset.url) 
      : vg.loadCSV(dataset.name, dataset.url);
    return vg
      .coordinator()
      .exec(creationQuery);
  }

  private isSupportedType(type: string): type is "csv" | "parquet" {
    return ["csv", "parquet"].includes(type);
  }

  resolveUrlToDataset(url: string): Dataset {
      // Derive a filename from the URL, e.g., "penguins.csv" from ".../penguins.csv"
      const filename = new URL(url).pathname.split("/").pop();
      if(!filename) throw new Error(`Invalid URL: ${url}`);
      // split apart the name and extension, e.g ['penguins', 'csv']
      const [rawName, type] = [
        filename.substring(0, filename.lastIndexOf('.')), 
        filename.substring(filename.lastIndexOf('.') + 1)
      ];
      // clean the name, e.g. 'penguins' from 'pen-gui.ns'
      const name = rawName.replace(/[-.\\&]/g, '_');
      if (!this.isSupportedType(type)) {
        throw new Error(`Unsupported file type of URL: ${type}`);
      }
      return {name, url, type};
  }

  async rawQuery(query: string, send: boolean = false) {
    const dbConn = await this.duckdb.connect();
    try {
      if (send) {
        return await dbConn.send(query);
      } else {
        return await dbConn.query(query);
      }
    } finally {
      dbConn.close();
    }
  }

  async showTables() {
    const result = await this.rawQuery("show all tables")
    return result.toArray().map((x:any) => x.toJSON().name);
  }

  async registerFileBuffer(name: string, buffer: ArrayBuffer) {
    return await this.duckdb.registerFileBuffer(name, new Uint8Array(buffer));
  }
  
  async exec(query: string) {
    return this.vg.coordinator().exec(query);
  }

  async query(query: string): Promise<any> {
    return this.vg.coordinator().query(query)
  }

  async clear(options: {clients: boolean, cache: boolean}) {
    return this.vg.coordinator().clear(options);
  }
}