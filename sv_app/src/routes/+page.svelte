<script lang="ts">
  // Page component logic (if any)
  import DarkModeToggle from "$lib/components/DarkModeToggle.svelte";
  import ShortcutRibbon from "$lib/components/ShortcutRibbon.svelte";
  import DataTable from "$lib/components/DataTable.svelte";
  import EditorPanel from "$lib/components/EditorPanel.svelte";
  import { XQL, F } from "$lib/xql";
  import { Type } from "@uwdata/flechette"; // Import Type enum
  import * as aq from 'arquero';
  // import { DuckDB } from "@uwdata/mosaic-duckdb";
  import * as vg from "@uwdata/vgplot";
  import { onMount } from 'svelte';
  import { StateHistory } from "runed";

  const penguinsURL =
    "https://raw.githubusercontent.com/allisonhorst/palmerpenguins/refs/heads/main/inst/extdata/penguins.csv";

  let isDarkMode = $state(true);

  $effect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  let query = $state.raw(XQL.from("penguins"));
  let queryString = $state(XQL.from("penguins").toString());
  let limit = $state(50);
  let offset = $state(0);
  let sqlQuery : string = $derived(query.limit(limit).offset(offset).toSQL());
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

  let isDBReady = $state({ready: false});
  let dbError: unknown = $state(null);
  let isLoadingQuery = $state(false);
  let isLoadingMore = $state(false);
  let queryError: unknown = $state(null);
  let tableData: any | null = $state(null);
  let hasMoreData = $state(true); // New state to track if there's more data to load

  onMount(async () => {
    try {
      vg.coordinator().databaseConnector(vg.wasmConnector());
      await vg.coordinator().exec(vg.loadCSV("penguins", penguinsURL));
      console.log("Database initialized with penguins data.");
      isDBReady.ready = true;
    } catch (error) { // `error` is of type `unknown
      console.error("Database initialization error:", error);
      dbError = error;
    }
  });

  let tcount = $state(0);
  let queryTime = $state(0);
  let tableHeaders: { index: number, name: string, type: string, selected: boolean }[] = $state([]); // Add this
  let selectedColumns = $derived(
    tableHeaders
      .filter((header) => header.selected)
      .map((header) => `"${header.name}"`)
  );
  $inspect(selectedColumns)


  // Map Arrow Type IDs to human-readable strings
  const arrowTypeNames = Object.fromEntries(
    Object.entries(Type).map(([key, value]) => [value, key])
  );
  $inspect(arrowTypeNames);

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
            }
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
  function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Debounced scroll handler
  const handleScroll = debounce((event: Event) => {
    const target = event.target as HTMLElement;
    // Load more when the user is 200px from the bottom
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
    
    // Add hasMoreData to the condition
    if (isAtBottom && !isLoadingQuery && !isLoadingMore && hasMoreData && tableData && tableData._nrows > 0) {
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

  const shortcuts = [
    {
      key: "s",
      label: "select",
      action: () => {
        let colnames = selectedColumns.map(c => c.replaceAll('"', ''));
        if (colnames.length === 0) {
          colnames = ['*'];
        }
        queryString += "\n  .select(" + colnames.map(c => `"${c}"`).join(', ') + ")";
      },
    },
    {
      key: "g",
      label: "group/count",
      action: () => {
        let colnames = selectedColumns.map(c => c.replaceAll('"', ''));
        let countCol = 'count';
        if (colnames.length === 0) {
          return;
        }
        while (colnames.includes(countCol)) {
          countCol += '_' + countCol;
        }
        queryString += "\n  .group_by(" + colnames.map(c => `"${c}"`).join(', ') + `)\n  .agg(F.count('*').alias('${countCol}'))\n  .order_by(F.col('${countCol}').desc())`;
      },
    },
    {
      key: "p",
      label: "plot",
      action: () => {
        // Not yet implemented
      },
    },
    {
      key: "z",
      label: "undo",
      action: () => {
        queryHistory.undo();
      },
    },
    {
      key: "Z",
      label: "redo",
      action: () => {
        queryHistory.redo();
      },
    },
    {
      key: "q",
      label: "log query",
      action: () => {
        console.log(queryString);
      },
    },
    {
      key: "r",
      label: "reset",
      action: () => {
        offset = 0;
        hasMoreData = true; // Reset hasMoreData when the query is reset
        queryString = "XQL.from('penguins')";
      },
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
        <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center">
          Interactive Data Editor
          <span class="text-2xl ml-3" role="img" aria-label="rocket emoji">🚀</span>
          <DarkModeToggle bind:isDarkMode={isDarkMode} />
        </h1>
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
            {isLoadingQuery}
            {queryTime}
            {tcount}
            bind:tableHeaders
            onscroll={handleScroll}
            bind:scrollContainer={tableScrollContainer}
          />
        </div>
      </main>

      <!-- Shortcut Ribbon -->
      <ShortcutRibbon {shortcuts} />
    </div>
  </div>
{/if}
