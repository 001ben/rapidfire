<script lang="ts">
  // Page component logic (if any)
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { sql } from "@codemirror/lang-sql";
  import { vsCodeDark  } from '@fsegurai/codemirror-theme-vscode-dark';
  import { XQL, F } from "../xql";
  import { Type } from "@uwdata/flechette"; // Import Type enum
  // import { DuckDB } from "@uwdata/mosaic-duckdb";
  import * as vg from "@uwdata/vgplot";
  import { onMount } from 'svelte';
  import { StateHistory } from "runed";

  const penguinsURL =
    "https://raw.githubusercontent.com/allisonhorst/palmerpenguins/refs/heads/main/inst/extdata/penguins.csv";

  // Define a reusable style for keyboard keys
  const kbdClass =
    "font-sans font-semibold bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 text-xs";

  let isDarkMode = $state(false);

  $effect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  let query = $state.raw(XQL.from("penguins"));
  let queryString = $state(XQL.from("penguins").toString());
  let sqlQuery : string = $derived(query.toSQL());

  $effect(() => {
    const currentQueryString = queryString;
    try {
      const newQuery = eval(currentQueryString);
      if (newQuery instanceof XQL) {
        query = newQuery;
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

  let isRibbonOpen = $state(false);
  let showSqlEditor = $state(true);

  let isDBReady = $state({ready: false});
  let dbError: unknown = $state(null);
  let isLoadingQuery = $state(false);
  let queryError: unknown = $state(null);
  let tableData: any | null = $state(null);

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

  let isDragging = $state(false);
  let dragSelectionState = $state(false);

  function handleHeaderMouseDown(index: number, event: MouseEvent) {
    event.preventDefault();

    // Unfocus the CodeMirror editor if it's active
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl?.classList.contains('cm-content')) {
      activeEl.blur();
    }

    isDragging = true;
    // Determine if we are selecting or deselecting based on the initial header's state
    const initialSelected = !tableHeaders[index].selected;
    dragSelectionState = initialSelected;
    tableHeaders[index].selected = initialSelected;
  }

  function handleHeaderMouseEnter(index: number) {
    if (isDragging) {
      tableHeaders[index].selected = dragSelectionState;
    }
  }

  // Map Arrow Type IDs to human-readable strings
  const arrowTypeNames = Object.fromEntries(
    Object.entries(Type).map(([key, value]) => [value, key])
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
        isLoadingQuery = true;
        queryError = null;
        if (!currentSqlQuery) {
          tableData = [];
          tcount = 0;
          queryTime = 0;
          return;
        }

        const startTime = performance.now();
        const result = await vg.coordinator().query(currentSqlQuery);
        queryTime = performance.now() - startTime;
        tableData = result;

        // Populate tableHeaders from Arrow schema
        if (tableData && tableData.schema && tableData.schema.fields) {
          tableHeaders = tableData.schema.fields.map((field, index) => {
            const header_info = {
              index: index,
              name: field.name,
              type: getArrowTypeName(field.type.typeId),
              selected: false,
            }
            return header_info;
          });
        } else {
          tableHeaders = [];
        }
        tcount = result.numRows;
      } catch (error) {
        queryError = error;
      } finally {
        isLoadingQuery = false;
      }
    }
    runQuery();
  });

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
        queryString += "\n  .group_by(" + colnames.map(c => `"${c}"`).join(', ') + ")\n  .agg(F.count('*').alias('count'))\n  .order_by(F.col('count').desc())";
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
        queryString = "XQL.from('penguins')";
      },
    },
  ];
</script>

<svelte:window {onkeydown} onmouseup={() => isDragging = false} />
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
          <span class="text-2xl ml-3" role="img" aria-label="rocket emoji"
            >🚀</span
          >
          <button
            onclick={() => isDarkMode = !isDarkMode}
            class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Toggle Dark Mode"
          >
            {#if isDarkMode}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            {/if}
          </button>
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
        <div
          id="editor-container"
          class="relative flex flex-shrink-0 h-56 md:h-64 rounded-lg shadow-md overflow-hidden border border-slate-300 dark:border-slate-700"
        >
          <button
            onclick={() => showSqlEditor = !showSqlEditor}
            class="absolute top-2 right-2 z-10 p-1 rounded bg-slate-100/50 hover:bg-slate-200 dark:bg-slate-900/50 dark:hover:bg-slate-700 text-xs font-mono"
            title="Toggle SQL View"
          >
            SQL
          </button>
          <div class={{'w-1/2': showSqlEditor, 'w-full': !showSqlEditor, "h-full transition-all duration-300": true}}>
            <CodeMirror
              class="w-full h-full bg-white dark:bg-slate-800"
              bind:value={queryString}
              lang={javascript()}
              themes={isDarkMode ? [vsCodeDark] : []}
            />
          </div>
          {#if showSqlEditor}
            <div class="h-full w-1/2 border-l border-slate-300 dark:border-slate-600">
              <CodeMirror
                class="w-full h-full bg-slate-50 dark:bg-slate-800/50"
                value={sqlQuery}
                lang={sql()}
                themes={isDarkMode ? [vsCodeDark] : []}
                readonly={true}
              />
            </div>
          {/if}
        </div>
        {#if queryError}
          <div
            class="my-2 p-3 bg-red-100 border border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 rounded-md shadow-sm"
          >
            <strong>Query Error:</strong>
            {queryError.message}
          </div>
        {/if}
        <div
          id="table-container"
          class="flex-grow min-h-0 overflow-auto rounded-lg shadow-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 mt-4 relative"
        >
          {#if tableData}
            <p
              class="p-2 bg-slate-50 border-b border-slate-300 text-sm text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 sticky top-0 flex justify-between"
            >
              {#if isLoadingQuery}
                <span class="text-slate-500 flex items-center">
                  <span
                    class="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-500 mr-2"
                  >
                  </span>
                  Running query...
                </span>
              {:else if queryTime > 0}
                <span>Showing {tcount} rows</span>
                <span class="text-slate-500"
                  >Query took {queryTime.toFixed(2)}ms</span
                >
              {/if}
            </p>
            <table id="data-table" class="min-w-full text-sm">
              <thead class="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                <tr>
                  {#each tableHeaders as header, index}
                    <th class="p-3 text-left tracking-wider cursor-pointer"
                      class:hover:bg-slate-300={!header.selected}
                      class:dark:hover:bg-slate-600={!header.selected}
                      class:bg-blue-200={header.selected}
                      class:hover:bg-blue-300={header.selected}
                      class:dark:bg-blue-800={header.selected}
                      class:hover:dark:bg-blue-900={header.selected}
                      onmousedown={(e) => handleHeaderMouseDown(index, e)}
                      onmouseenter={() => handleHeaderMouseEnter(index)}>
                      <div class="flex flex-col">
                        <span class="font-semibold">{header.name}</span>
                        <span class="font-normal text-slate-500 dark:text-slate-400">{header.type}</span>
                      </div>
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                {#each tableData as row, i}
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    {#each Object.values(row) as val}
                      <td class="p-3 whitespace-nowrap">{val}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else if !isLoadingQuery}
            <p class="p-4 text-center text-slate-500">No data to display.</p>
          {:else}
            <div>huh?</div>
          {/if}
        </div>
      </main>

      <!-- Shortcut Ribbon -->
      <aside
        class="group flex-shrink-0 transition-all duration-300 ease-in-out pl-2 pr-2 pb-2"
        class:w-48={isRibbonOpen || undefined}
        class:w-16={!isRibbonOpen || undefined}
        class:hover:w-48={!isRibbonOpen || undefined}
      >
        <div class="flex justify-center mb-2">
          <button
            onclick={() => (isRibbonOpen = !isRibbonOpen)}
            class="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isRibbonOpen ? "Collapse shortcuts" : "Expand shortcuts"}
            aria-label={isRibbonOpen
              ? "Collapse shortcuts"
              : "Expand shortcuts"}
            aria-expanded={isRibbonOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-transform duration-300"
              class:rotate-180={isRibbonOpen}
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
        <div class="space-y-2">
          {#each shortcuts as shortcut (shortcut.key)}
            <button
              class="w-full flex items-center p-2 rounded-md text-left transition-colors bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer group-hover:justify-between"
              class:justify-between={isRibbonOpen || undefined}
              class:justify-center={!isRibbonOpen || undefined}
              onclick={() => shortcut.action()}
            >
              <span
                class="text-sm text-slate-700 font-medium whitespace-nowrap overflow-hidden
                         transition-all duration-300 ease-in-out group-hover:max-w-full group-hover:opacity-100"
                class:max-w-full={isRibbonOpen || undefined}
                class:opacity-100={isRibbonOpen || undefined}
                class:max-w-0={!isRibbonOpen || undefined}
                class:opacity-0={!isRibbonOpen || undefined}
              >
                {shortcut.label}
              </span>
              <kbd class={kbdClass}>{shortcut.key}</kbd>
            </button>
          {/each}
        </div>
      </aside>
    </div>
  </div>
{/if}
