<script lang="ts">
  // Page component logic (if any)
  import DarkModeToggle from "$lib/components/DarkModeToggle.svelte";
  import ShortcutRibbon from "$lib/components/ShortcutRibbon.svelte";
  import DataTable from "$lib/components/DataTable.svelte";
  import EditorPanel from "$lib/components/EditorPanel.svelte";
  import PlotView from "$lib/components/PlotView.svelte";
  import { addGroupBy, addCast, addSort } from "$lib/actions";
  import { XQL, F } from "$lib/xql";
  import { Type } from "@uwdata/flechette"; // Import Type enum
  import { createShortcuts } from "$lib/shortcuts";
  // import { DuckDB } from "@uwdata/mosaic-duckdb";

  import { onMount } from "svelte";
  import { StateHistory } from "runed";

  let vg;
  let aq;

  const DATA_BASE_URL =
    "https://raw.githubusercontent.com/uwdata/mosaic/main/data/";

  const exampleDatasets = [
    {
      name: "penguins",
      url: "https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv",
      type: "csv",
    },
    { name: "athletes", url: `${DATA_BASE_URL}athletes.csv`, type: "csv" },
    {
      name: "seattle_weather",
      url: `${DATA_BASE_URL}seattle-weather.csv`,
      type: "csv",
    },
    {
      name: "pokemon",
      url: "https://gist.githubusercontent.com/armgilles/194bcff35001e7eb53a2a8b441e8b2c6/raw/92200bc0a673d5ce2110aaad4544ed6c4010f687/pokemon.csv",
      type: "csv",
    },
    {
      name: "latency",
      url: "https://pub-1da360b43ceb401c809f68ca37c7f8a4.r2.dev/data/observable-latency.parquet",
      type: "parquet",
    },
  ];

  const initialDataset = exampleDatasets[0];

  let isDarkMode = $state(false);

  $effect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  });

  let query = $state.raw(XQL.from(initialDataset.name));
  let queryString = $state(XQL.from(initialDataset.name).toString());
  // $inspect(queryString);

  let limit = $state(50);
  let offset = $state(0);
  let sqlQuery: string = $derived(query.limit(limit).offset(offset).toSQL());
  let viewMode = $state('table');
  let plotSpec = $state('');
  let customUrl = $state("");
  let tableScrollContainer: HTMLElement;

  $effect(() => {
    const currentQueryString = queryString;
    try {
      const newQuery = eval(currentQueryString);
      offset = 0; // Reset offset when the query string changes
      if (newQuery instanceof XQL) {
        if (tableScrollContainer) {
          tableScrollContainer.scrollTop = 0;
        }
        query = newQuery; // Limit to 50 rows for display
        queryError = null;
      } else {
        queryError = new Error("Evaluated code is not an XQL object");
      }
    } catch (e) {
      queryError = e;
    }
  });

  const queryHistory = new StateHistory(
    () => queryString,
    (q) => (queryString = q),
  );

  let isDBReady = $state({ ready: false });
  let dbError: unknown = $state(null);
  let isLoadingQuery = $state(false);
  let isLoadingMore = $state(false);
  let queryError: unknown = $state(null);
  let tableData: any | null = $state(null);
  let hasMoreData = $state(true); // New state to track if there's more data to load

  onMount(async () => {
    vg = await import("@uwdata/vgplot");
    aq = await import("arquero");
    try {
      // Set up the database connector
      vg.coordinator().databaseConnector(vg.wasmConnector());
      // Load the initial dataset
      await vg
        .coordinator()
        .exec(vg.loadCSV(initialDataset.name, initialDataset.url));
      console.log(`Database initialized with ${initialDataset.name} data.`);
      isDBReady.ready = true;
    } catch (error) {
      // `error` is of type `unknown
      console.error("Database initialization error:", error);
      dbError = error;
    }
  });

  async function loadDataset(dataset: {
    name: string;
    url: string;
    type: "csv" | "parquet";
  }) {
    isLoadingQuery = true;
    try {
      if (dataset.type === "csv") {
        await vg.coordinator().exec(vg.loadCSV(dataset.name, dataset.url));
      } else if (dataset.type === "parquet") {
        await vg.coordinator().exec(vg.loadParquet(dataset.name, dataset.url));
      }
      // Reset the query to select from the new table
      initialDataset.name = dataset.name;
      queryString = `XQL.from('${dataset.name}')`;
    } catch (e) {
      queryError = e;
    } finally {
      // The reactive effect on queryString will handle turning this off
      // but we do it here as a fallback.
      isLoadingQuery = false;
    }
  }

  async function loadCustomUrl() {
    if (!customUrl) return;
    try {
      // Derive a table name from the URL, e.g., "penguins" from ".../penguins.csv"
      const name =
        new URL(customUrl).pathname.split("/").pop()?.split(".")[0] ||
        "custom_data";
      await loadDataset({ name, url: customUrl, type: "csv" });
    } catch (e) {
      queryError = new Error(
        `Invalid URL or failed to parse table name. ${e.message}`,
      );
    }
  }

  function handleCustomUrlKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      loadCustomUrl();
    }
  }

  let tcount = $state(0);
  let queryTime = $state(0);
  let tableHeaders: {
    index: number;
    name: string;
    type: string;
    selected: boolean;
    isColorColumn?: boolean;
  }[] = $state([]); // Add this
  let selectedColumns = $derived(
    tableHeaders
      .filter((header) => header.selected)
      .map((header) => `"${header.name}"`),
  );

  let colorColumn = $derived(
    tableHeaders.find((h) => h.isColorColumn)?.name
  );

  // Map Arrow Type IDs to human-readable strings
  const arrowTypeNames = Object.fromEntries(
    Object.entries(Type).map(([key, value]) => [value, key]),
  );

  function getArrowTypeName(typeId: number): string {
    // For Dictionary type, a more robust solution might inspect `type.dictionary.dictionary.typeId`
    // For now, we return "Dictionary" or "Utf8" if it's a string dictionary.
    if (typeId === Type.Dictionary) return "Dictionary";
    return arrowTypeNames[typeId] || "Unknown";
  }

  $effect(() => {
    if (!isDBReady.ready) return;

    const currentSqlQuery = sqlQuery;

    async function runQuery() {
      try {
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
        const result = await vg.coordinator().query(currentSqlQuery);
        queryTime = performance.now() - startTime;
        hasMoreData = result && result.numRows === limit; // If fewer than 'limit' rows returned, no more data
        if (offset === 0 || !tableData) {
          tableData = aq.fromArrow(result);
          tcount = result ? result.numRows : 0;
        } else if (tableData && result) {
          // Append new data for infinite scroll
          tableData = tableData.concat(aq.fromArrow(result));
          tcount = tableData._nrows;
        }

        if (offset === 0 && result && result.schema && result.schema.fields) {
          tableHeaders = result.schema.fields.map((field, index) => {
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
      } catch (error) {
        queryError = error;
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

  function onkeydown(event: KeyboardEvent): void {
    if (
      event.target &&
      (event.target as HTMLElement).className === "cm-content"
    ) {
      return;
    }
    const shortcut = shortcuts.find((sc) => sc.key === event.key);
    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }

  function resetQuery() {
    offset = 0;
    hasMoreData = true;
    queryString = `XQL.from('${initialDataset.name}')`;
  }

  const shortcuts = createShortcuts({
    queryString: {
      get: () => queryString,
    },
    selectedColumns: {
      get: () => selectedColumns,
    },
    colorColumn: {
        get: () => colorColumn,
    },
    currentTableName: () => initialDataset.name,
    createViewCurrentQuery: async () => {
      console.log("creating view ", `CREATE OR REPLACE VIEW ${initialDataset.name}_view AS ${query.toSQL()}`);
      await vg.coordinator().exec(`CREATE OR REPLACE VIEW ${initialDataset.name}_view AS ${query.toSQL()}`);
      await vg.coordinator().clear({clients: false, cache: true})
      let results = await vg.coordinator().query(`select * from ${initialDataset.name}_view limit 10`);
      console.log("results", results.toArray());
    },
    queryHistory,
    reset: resetQuery,
    setQuery: (val) => (queryString = val),
    currentViewMode: () => viewMode,
    setViewMode: (mode) => viewMode = mode,
    setPlotSpec: (spec) => plotSpec = spec,
  });

  const setQuery = (val) => (queryString = val);
  const items = [
    {
      label: "Cast",
      children: [
        { label: "to String", action: (header) => { addCast(queryString, setQuery, header.name, "VARCHAR"); } },
        { label: "to Integer", action: (header) => { addCast(queryString, setQuery, header.name, "INTEGER"); } },
        { label: "to Float", action: (header) => { addCast(queryString, setQuery, header.name, "FLOAT"); } },
        { label: "to Decimal", action: (header) => { addCast(queryString, setQuery, header.name, "DECIMAL"); } },
        { label: "to Date", action: (header) => { addCast(queryString, setQuery, header.name, "DATE"); } },
      ],
    },
    {
      label: "Sort",
      children: [
        { label: "Ascending", action: (header) => { addSort(queryString, setQuery, header.name, 'asc'); } },
        { label: "Descending", action: (header) => { addSort(queryString, setQuery, header.name, 'desc'); } },
      ],
    },
  ];
</script>

<svelte:window {onkeydown} />
{#if dbError}
  <div
    class="p-4 bg-red-100 text-red-800 h-screen flex items-center justify-center"
  >
    <strong>Fatal Error:</strong> Could not load database. {dbError.message}
  </div>
{:else if !isDBReady.ready}
  <div class="p-4 text-center h-screen flex items-center justify-center">
    <p class="text-2xl text-slate-500">Initializing Database...</p>
  </div>
{:else}
  <div
    class="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 flex flex-col h-screen p-4 md:p-6 lg:p-8 box-border"
  >
    <header class="mb-4 flex-shrink-0">
      <div class="flex justify-between items-center">
        <h1
          class="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center"
        >
          Interactive Data Explorer
          <span class="text-2xl ml-3" role="img" aria-label="rocket emoji"
            >🚀</span
          >
          <DarkModeToggle bind:isDarkMode />
          <div class="ml-4 border-l border-slate-300 dark:border-slate-600 pl-4">
            <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-200 dark:bg-slate-700">
                <button 
                    class="px-3 py-1 text-sm font-semibold rounded-md transition-colors"
                    class:bg-white={viewMode === 'table'}
                    class:dark:bg-slate-800={viewMode === 'table'}
                    onclick={() => viewMode = 'table'}
                >Table</button>
                <button 
                    class="px-3 py-1 text-sm font-semibold rounded-md transition-colors"
                    class:bg-white={viewMode === 'plot'}
                    class:dark:bg-slate-800={viewMode === 'plot'}
                    onclick={() => viewMode = 'plot'}
                >Plot</button>
            </div>
          </div>
        </h1>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-slate-600 dark:text-slate-400"
              >Load example:</span
            >
            {#each exampleDatasets as dataset}
              <button
                class="px-2 py-1 text-xs font-semibold rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                onclick={() => loadDataset(dataset)}
              >
                {dataset.name}
              </button>
            {/each}
          </div>
          <div class="max-w-sm flex-grow">
            <div class="flex items-center gap-2">
              <input
                type="text"
                bind:value={customUrl}
                onkeydown={handleCustomUrlKeydown}
                placeholder="Or load from URL..."
                class="w-48 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                class="px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-400 dark:disabled:bg-slate-600"
                onclick={loadCustomUrl}
                disabled={!customUrl || isLoadingQuery}>Load</button
              >
            </div>
          </div>
        </div>
      </div>
      <p class="text-slate-600 mt-1">
        Edit code to transform the data. Click a cell for <code
          class="bg-slate-200 px-1 rounded">filter</code
        >, or click headers to select columns.
      </p>
    </header>

    <div class="flex-grow flex gap-2 min-h-0">
      <!-- Main Content -->
      <main class="flex-grow flex flex-col min-h-0">
        {#if viewMode === 'table'}
            <EditorPanel bind:queryString {sqlQuery} {isDarkMode} />
            {#if queryError}
              <div
                class="my-2 p-3 bg-red-100 border border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 rounded-md shadow-sm"
              >
                <strong>Query Error:</strong>
                {queryError.message}
              </div>
            {/if}
            <div class="flex-grow min-h-0 flex">
              <DataTable
                {tableData}
                bind:tableHeaders
                {isLoadingQuery}
                {queryTime}
                bind:scrollContainer={tableScrollContainer}
                {items}
                {queryString}
                setQuery={(val) => {
                  queryString = val;
                }}
                {tcount}
                onscroll={handleScroll}
              />
            </div>
        {:else if viewMode === 'plot'}
            <PlotView bind:spec={plotSpec} {isDarkMode} />
        {/if}
      </main>

      <!-- Shortcut Ribbon -->
      <ShortcutRibbon {shortcuts} />
    </div>
  </div>
{/if}
