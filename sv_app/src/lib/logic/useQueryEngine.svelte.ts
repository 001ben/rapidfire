import { XQL, F } from "$lib/xql";
import { StateHistory } from "runed";
import type { DataManager } from "$lib/logic/data";
import { Type } from "@uwdata/flechette";

export interface TableHeader {
  index: number;
  name: string;
  type: string;
  selected: boolean;
  isColorColumn?: boolean;
}

// Map Arrow Type IDs to human-readable strings
const arrowTypeNames = Object.fromEntries(
  Object.entries(Type).map(([key, value]) => [value, key]),
);
console.log(arrowTypeNames);

function getArrowTypeName(typeId: number): string {
  // For Dictionary type, a more robust solution might inspect `type.dictionary.dictionary.typeId`
  // For now, we return "Dictionary" or "Utf8" if it's a string dictionary.
  if (typeId === Type.Dictionary) return "Dictionary";
  return arrowTypeNames[typeId] || "Unknown";
}

const createQuery = (str: string) => {
  return new Function('XQL', 'F', `return ${str}`)(XQL, F);
};

export function useQueryEngine() {
  let db = $state<DataManager | null>(null);

  let queryString = $state("XQL.from('')");
  const queryHistory = new StateHistory(
    () => queryString,
    (q: string) => (queryString = q),
  );
  let query = $state.raw(createQuery(queryString));

  // Paging State
  let limit = $state(50);
  let offset = $state(0);
  let hasMoreData = $state(true);

  // Result State
  const sqlQuery = $derived(db ? query.limit(limit).offset(offset).toSQL() : '');
  let tableData = $state<any | null>(null);
  let tableHeaders = $state<TableHeader[]>([]);
  const selectedColumns = $derived(tableHeaders.filter(h => h.selected));
  const selectedColumnNames = $derived(selectedColumns.map(h => `"${h.name}"`));
  const colorColumn = $derived(tableHeaders.find(h => h.isColorColumn)?.name);
  let tcount = $state(0);
  let queryTime = $state(0);

  // Status State
  let isLoadingQuery = $state(false);
  let isLoadingMore = $state(false);
  let queryError = $state<string | null>(null);

  // TableScroll
  let tableScrollContainer = $state<HTMLElement | undefined>(undefined);

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
        query = newQuery; // Limit to 50 rows for display
        queryError = null;
      } else {
        queryError = "Evaluated code is not an XQL object";
      }
    } catch (e) {
      if (e instanceof Error) {
        queryError = e.message;
      } else {
        console.error(queryError)
        queryError = "Unknown error: " + e;
      }
    }
  });

  
  $effect(() => {
    if (!db) {
      tableData=null;
      return;
    }
    const currentSqlQuery = sqlQuery;

    async function runQuery() {
      try {
        if (!db) return;
        if (offset === 0) isLoadingQuery = true;
        else isLoadingMore = true;
        queryError = null;
        if (!currentSqlQuery) {
          tableData = [];
          tcount = 0;
          if (offset === 0) queryTime = 0;
          return;
        }

        const startTime = performance.now();
        const result = await db.query(currentSqlQuery);
        queryTime = performance.now() - startTime;
        hasMoreData = result && result.numRows === limit; // If fewer than 'limit' rows returned, no more data
        if (offset === 0 || !tableData) {
          tableData = db.aq.fromArrow(result);
          tcount = result ? result.numRows : 0;
        } else if (tableData && result) {
          // Append new data for infinite scroll
          tableData = tableData.concat(db.aq.fromArrow(result));
          tcount = tableData._nrows;
        }
        
        let fields = result?.schema?.fields;
        if (offset === 0 && fields) {
          tableHeaders = result.schema.fields.map((field: {name: string, type: {typeId: number}}, index: number) => {
            const header_info = {
              index: index,
              name: field.name,
              type: getArrowTypeName(field.type.typeId),
              selected: false,
              isColorColumn: false,
            };
            return header_info;
          });
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


  // Debounce utility function
  function debounce<T extends (...args: any[]) => void>(
    func: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Debounced scroll handler
  const handleScroll = debounce((event: Event) => {
    const target = event.target as HTMLElement;
    // Load more when the user is 200px from the bottom
    const isAtBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 200;

    // Add hasMoreData to the condition
    if (
      isAtBottom &&
      !isLoadingQuery &&
      !isLoadingMore &&
      hasMoreData &&
      tableData &&
      tableData._nrows > 0
    ) {
      // We have data, and we're not currently loading, so fetch the next page.
      offset += limit;
    }
  }, 100); // Debounce by 100ms
  
  function setQuery(newQuery: string) {
    queryString = newQuery;
  }
  
  function resetQuery(newQuery: string) {
    offset = 0;
    hasMoreData = true;
    queryString = newQuery;
  }

  function setDb(newDb: DataManager, initialQuery: string) {
    db = newDb;
    resetQuery(initialQuery);
  }

  function setScrollContainer(el: HTMLElement | undefined) {
    tableScrollContainer = el;
  }

  return {
    // State
    get query() { return query },
    get queryString() { return queryString },
    set queryString(newString: string) { queryString = newString; },
    get limit() { return limit },
    get sqlQuery() { return sqlQuery },
    get tableData() { return tableData },
    get tableHeaders() { return tableHeaders },
    set tableHeaders(newHeaders: TableHeader[]) { tableHeaders = newHeaders; },
    get tcount() { return tcount },
    get queryTime() { return queryTime },
    get isLoadingQuery() { return isLoadingQuery },
    set isLoadingQuery(newLoading: boolean) { isLoadingQuery = newLoading; },
    get isLoadingMore() { return isLoadingMore },
    get queryError() { return queryError },
    set queryError(newError: string | null) { queryError = newError; },
    // Methods
    setDb,
    setQuery,
    resetQuery,
    handleScroll,
    setScrollContainer,
    queryHistory,
    // Derived state for shortcuts
    get selectedColumns() { return selectedColumns; },
    get selectedColumnNames() { return selectedColumnNames; },
    get colorColumn() { return colorColumn; }
  };
}