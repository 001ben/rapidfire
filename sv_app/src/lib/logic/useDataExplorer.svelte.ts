// src/lib/logic/useDataExplorer.svelte.ts
import { DataManager, exampleDatasets } from "$lib/logic/data";
import { type Dataset, type TableHeader } from "./types";
import { XQL, F, c} from "$lib/xql";
import { StateHistory } from "runed";
import { Type } from "@uwdata/flechette";

// --- Helper Functions from useQueryEngine ---
const arrowTypeNames = Object.fromEntries(
  Object.entries(Type).map(([key, value]) => [value, key]),
);
function getArrowTypeName(typeId: number): string {
  if (typeId === Type.Dictionary) return "Dictionary"; // Simple case
  return arrowTypeNames[typeId] || "Unknown";
}
const createQuery = (str: string) => {
  return new Function('XQL', 'F', 'c', str)(XQL, F, c);
};

// --- The Main Hook ---
export function useDataExplorer() {
  
  // === Database State (from useDatabase) ===
  let db = $state<DataManager | null>(null);
  let isDbReady = $state(false);
  let dbError = $state<string | null>(null);

  // === Active Dataset State (The Bug Fix) ===
  let activeDataset = $state<Dataset>(exampleDatasets[0]);

  // === Query State (from useQueryEngine) ===
  let queryString = $state("return XQL.from('')");
  const queryHistory = new StateHistory(
    () => queryString,
    (q: string) => (queryString = q),
  );
  let query = $state.raw(createQuery(queryString));
  let limit = $state(50);
  let offset = $state(0);
  let hasMoreData = $state(true);
  
  // === Result State (from useQueryEngine) ===
  let sqlQuery = $state(db ? query.limit(limit).offset(offset).toSQL() : '');
  let tableData = $state<any | null>(null);
  let tableHeaders = $state<TableHeader[]>([]);
  const selectedColumns = $derived(tableHeaders.filter(h => h.selected));
  const selectedColumnNames = $derived(selectedColumns.map(h => `"${h.name}"`));
  const colorColumn = $derived(tableHeaders.find(h => h.isColorColumn)?.name);
  let tcount = $state(0);
  let queryTime = $state(0);

  // === Status State (from useQueryEngine) ===
  let isLoadingQuery = $state(false);
  let isLoadingMore = $state(false);
  let queryError = $state<string | null>(null);

  // === UI State (from useQueryEngine) ===
  let tableScrollContainer = $state<HTMLElement | undefined>(undefined);

  // === Core Logic: Initialise ===
  async function initialise() {
    try {
      db = await DataManager.create();
      let query = await importDataset(activeDataset, false); // Don't reset query here
      isDbReady = true;
      if (query) {
        resetQuery(query); // Now set the initial query
      }
    } catch (e) {
      console.error("Database initialization error:", e);
      dbError = e instanceof Error ? e.message : String(e);
    }
  }

  // === Core Logic: Data Loading Methods ===
  async function importDataset(dataset: Dataset, doResetQuery = true) {
    if (!db) return;
    isLoadingQuery = true; // Set loading state
    try {
      await db.importDataset(dataset);
      activeDataset = dataset; // Update active dataset
      const newQuery = XQL.from(dataset.name).toString();
      if (doResetQuery) {
        resetQuery(newQuery);
      }
      return newQuery;
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    } finally {
      isLoadingQuery = false;
    }
  }

  async function loadCustomUrl(url: string) {
    if (!db || !url) return;
    isLoadingQuery = true; // Set loading state
    try {
      let customDataset = db.resolveUrlToDataset(url);
      await importDataset(customDataset);
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    } finally {
      isLoadingQuery = false;
    }
  }

  async function loadFile(file: File, arrayBuffer: ArrayBuffer) {
    if (!db) throw new Error("Database not initialized");
    isLoadingQuery = true; // Set loading state
    try {
      const { cleanName, extension } = {
        cleanName: file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_]/g, '_'),
        extension: file.name.substring(file.name.lastIndexOf(".")+1)
      };
      
      let tableName = cleanName;
      if (!/^[a-zA-Z_]/.test(tableName)) {
        tableName = '_' + tableName;
      }
      
      const tableNames = await db.showTables();
      if(tableNames.includes(tableName)) {
        let i = 1;
        while(tableNames.includes(tableName + i)) { i++; }
        tableName = tableName + i;
      }
      
      await db.registerFileBuffer(file.name, arrayBuffer);
      
      switch(extension) {
        case 'csv':
          await db.rawQuery(`CREATE TABLE ${tableName} as select * from read_csv('${file.name}')`, true);
          break;
        case 'xlsx':
          await db.rawQuery(`CREATE TABLE ${tableName} as select * from read_xlsx('${file.name}', header = true)`, true);
          break;
        case 'parquet':
          await db.rawQuery(`CREATE TABLE ${tableName} as select * from read_parquet('${file.name}')`, true);
          break;
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }

      activeDataset = { name: tableName, url: file.name, type: extension as any };
      resetQuery(XQL.from(tableName).toString());

    } catch(e) {
      console.error("File load error:", e);
      queryError = e instanceof Error ? e.message : String(e);
    } finally {
      isLoadingQuery = false;
    }
  }


  // === Core Logic: Query Execution (from useQueryEngine) ===
  $effect(() => {
    if (!db) return;
    const currentQueryString = queryString;
    if(!F || !XQL) return;
    try {
      const newQuery = createQuery(currentQueryString);
      offset = 0; // Reset offset when the query string changes
      if (newQuery instanceof XQL) {
        if (tableScrollContainer) {
          tableScrollContainer.scrollTop = 0;
        }
        query = newQuery;
        queryError = null;
      } else {
        queryError = "Evaluated code is not an XQL object";
      }
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    }
  });

  $effect(() => {
    if (!db) return;
    $inspect(sqlQuery);

    async function runQuery() {
      try {
        if (!db) return;

        // This effect now also handles SQL query generation
        const newSqlQuery = query.limit(limit).offset(offset).toSQL();
        if (newSqlQuery === sqlQuery && !isLoadingQuery) return; // Do nothing if the query is the same
        sqlQuery = newSqlQuery;
        queryError = null;

        if (offset === 0) isLoadingQuery = true;
        else isLoadingMore = true;

        if (!newSqlQuery) {
          tableData = []; tcount = 0; queryTime = 0;
          return;
        }

        const startTime = performance.now();
        const result = await db.query(newSqlQuery);
        queryTime = performance.now() - startTime;

        hasMoreData = result && result.numRows === limit;

        if (offset === 0 || !tableData) {
          tableData = db.aq.fromArrow(result);
          tcount = result ? result.numRows : 0;
        } else if (tableData && result) {
          tableData = tableData.concat(db.aq.fromArrow(result));
          tcount = tableData._nrows;
        }
        
        let fields = result?.schema?.fields as {name: string, type: {typeId: number}}[] | undefined;
        if (offset === 0 && fields) {
          tableHeaders = fields.map((field, index) => ({
            index: index,
            name: field.name,
            type: getArrowTypeName(field.type.typeId),
            selected: false,
            isColorColumn: false,
          }));
        }
      } catch (e) {
        queryError = e instanceof Error ? e.message : String(e);
      } finally {
        if (offset === 0) isLoadingQuery = false;
        else isLoadingMore = false;
      }
    }
    runQuery();
  });

  // === Core Logic: Paging and Setters (from useQueryEngine) ===
  const handleScroll = debounce((event: Event) => {
    const target = event.target as HTMLElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;

    if (isAtBottom && !isLoadingQuery && !isLoadingMore && hasMoreData && tableData && tableData._nrows > 0) {
      offset += limit;
    }
  }, 100);
  
  function setQuery(newQuery: string) {
    queryString = newQuery.includes("return ") ? newQuery : "return " + newQuery;
  }
  
  function resetQuery(newQuery: string) {
    offset = 0;
    hasMoreData = true;
    queryString = newQuery.includes("return ") ? newQuery : "return " + newQuery;
  }

  function setScrollContainer(el: HTMLElement | undefined) {
    tableScrollContainer = el;
  }
  
  // Debounce utility function
  function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  async function rawExecSQL(sqlQuery: string) {
    return await db?.rawQuery(sqlQuery);
  }

  async function clearVGCachedData() {
    return await db?.clear({clients: true, cache: true});
  }

  // === Public Interface ===
  return {
    // State
    get isDbReady() { return isDbReady },
    get dbError() { return dbError },
    get activeDataset() { return activeDataset },
    get query() { return query },
    get queryString() { return queryString },
    set queryString(newString: string) { setQuery(newString); },
    get sqlQuery() { return sqlQuery },
    get tableData() { return tableData },
    get tableHeaders() { return tableHeaders },
    set tableHeaders(newHeaders: TableHeader[]) { tableHeaders = newHeaders; },
    get tcount() { return tcount },
    get queryTime() { return queryTime },
    get isLoadingQuery() { return isLoadingQuery },
    get isLoading() { return isLoadingQuery }, // Alias for consistency with old useDatabase
    get isLoadingMore() { return isLoadingMore },
    get queryError() { return queryError },
    get selectedColumns() { return selectedColumns; },
    get selectedColumnNames() { return selectedColumnNames; },
    get colorColumn() { return colorColumn; },
    
    // Methods
    initialise,
    importDataset,
    loadCustomUrl,
    loadFile,
    setQuery,
    resetQuery,
    handleScroll,
    setScrollContainer,
    queryHistory,
    rawExecSQL,
    clearVGCachedData,
  };
}