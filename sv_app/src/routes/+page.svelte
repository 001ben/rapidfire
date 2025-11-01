<script lang="ts">
  // Page component logic (if any)
  import DarkModeToggle from "$lib/components/DarkModeToggle.svelte";
  import ShortcutRibbon from "$lib/components/ShortcutRibbon.svelte";
  import DataTable from "$lib/components/DataTable.svelte";
  import EditorPanel from "$lib/components/EditorPanel.svelte";
  import PlotView from "$lib/components/PlotView.svelte";
  import { addCast, addSort } from "$lib/logic/actions";
  import { createShortcuts } from "$lib/logic/shortcuts";
  import { getNotificationsContext } from 'svelte-notifications';
  import { useDatabase } from '$lib/logic/useDatabase.svelte';
  import { useQueryEngine } from '$lib/logic/useQueryEngine.svelte';
  import { getDefaultPlotSpec } from "$lib/logic/shortcuts";
  const { addNotification } = getNotificationsContext();
  import CollapsibleEditor from "$lib/components/CollapsibleEditor.svelte";

  import type { TableHeader } from '$lib/logic/types';
  import { onMount } from "svelte";

  import type {Dataset} from '$lib/logic/data'
  import {DataManager, exampleDatasets} from "$lib/logic/data";

  const initialDataset = exampleDatasets[0];

  const db = useDatabase(initialDataset);
  const queryEngine = useQueryEngine();

  let viewMode : 'table' | 'plot' = $state('table');
  let viewName = $state('');
  let plotSpec = $state('');
  let customUrl = $state("");
  // let editorHeight = $state(224); // Default height in pixels (h-56)

  let tableScrollContainer = $state<HTMLElement | undefined>(undefined);
  
  $effect(() => {
    queryEngine.setScrollContainer(tableScrollContainer);
  });

  onMount(async () => {
      // Initialize the database
    const initialQuery = await db.initialise();
    if (initialQuery && db.instance) {
      queryEngine.setDb(db.instance, initialQuery);
    }
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

  async function handleLoadExample(dataset: Dataset) {
    if (!queryEngine) return;

    try {
      queryEngine.isLoadingQuery = true;
      const newQuery = await db.importDataset(dataset);
      if (newQuery) {
        queryEngine.resetQuery(newQuery);
      }
    } catch (e) {
      // Set the error on the queryEngine so the UI can display it
      queryEngine.queryError = e instanceof Error ? e.message : String(e);
    } finally {
      queryEngine.isLoadingQuery = false;
    }
  }

  // You should have a similar one for the URL loader
  async function handleLoadUrl() {
    if (!queryEngine || !customUrl) return; // (assuming ui from useUIState)
    try {
      queryEngine.isLoadingQuery = true;
      const newQuery = await db.loadCustomUrl(customUrl);
      if (newQuery) {
        queryEngine.resetQuery(newQuery);
      }
    } catch (e) {
      queryEngine.queryError = e instanceof Error ? e.message : String(e);
    } finally {
      queryEngine.isLoadingQuery = false;
    }
  }

  const shortcuts = createShortcuts({
    queryString: { get: () => queryEngine.queryString },
    selectedColumns: { get: () => queryEngine.selectedColumns },
    selectedColumnNames: { get: () => queryEngine.selectedColumnNames },
    colorColumn: { get: () => queryEngine.colorColumn },
    currentTableName: () => initialDataset.name,
    createViewCurrentQuery: async () => {
      console.log("creating view ", `CREATE OR REPLACE VIEW ${initialDataset.name}_view AS ${queryEngine.query.toSQL()}`);
      await db.instance.exec(`CREATE OR REPLACE VIEW ${initialDataset.name}_view AS ${queryEngine.query.toSQL()}`);
      await db.instance.clear({clients: false, cache: true})
    },
    queryHistory: queryEngine.queryHistory,
    reset: () => queryEngine.resetQuery(`XQL.from('${initialDataset.name}')`),
    setQuery: queryEngine.setQuery,
    currentViewMode: () => viewMode,
    setViewMode: (mode) => viewMode = mode,
    setPlotSpec: (spec, setViewName) => {
      plotSpec = spec;
      viewName = setViewName;
    },
  });

  const items = [
    {
      label: "Cast",
      children: [
        { label: "to String", action: (header: TableHeader) => { addCast(queryEngine.queryString, queryEngine.setQuery, header.name, "VARCHAR"); } },
        { label: "to Integer", action: (header: TableHeader) => { addCast(queryEngine.queryString, queryEngine.setQuery, header.name, "INTEGER"); } },
        { label: "to Float", action: (header: TableHeader) => { addCast(queryEngine.queryString, queryEngine.setQuery, header.name, "FLOAT"); } },
        { label: "to Decimal", action: (header: TableHeader) => { addCast(queryEngine.queryString, queryEngine.setQuery, header.name, "DECIMAL"); } },
        { label: "to Date", action: (header: TableHeader) => { addCast(queryEngine.queryString, queryEngine.setQuery, header.name, "DATE"); } },
      ],
    },
    {
      label: "Sort",
      children: [
        { label: "Ascending", action: (header: TableHeader) => { addSort(queryEngine.queryString, queryEngine.setQuery, header.name, 'asc'); } },
        { label: "Descending", action: (header: TableHeader) => { addSort(queryEngine.queryString, queryEngine.setQuery, header.name, 'desc'); } },
      ],
    },
    {
      label: "Copy Name", action: async (header: TableHeader) => {
        if (!navigator.clipboard) return;
        try {
          await navigator.clipboard.writeText(header.name);
          addNotification({
            text: `Copied "${header.name}" to clipboard.`,
            position: 'bottom-right',
            type: "success",
            removeAfter: 2000,
          });
        } catch (err) {
          console.error("Failed to copy: ", err);
        }
      }
    }
  ];
</script>

<svelte:window {onkeydown} />
{#if db.dbError}
  <div class="p-4 bg-red-100 text-red-800 h-screen flex items-center justify-center">
    <strong>Fatal Error:</strong> Could not load database. {db.dbError}
  </div>
{:else if !db.isDbReady}
  <div class="p-4 text-center h-screen flex items-center justify-center">
    <p class="text-2xl text-slate-500">Initializing Database...</p>
  </div>
{:else}
  <div class="bg-slate-100 text-slate-800 dark:bg-vscode-background dark:text-vscode-foreground flex flex-col h-screen p-4 md:p-6 lg:p-8 box-border">
    <header class="mb-4 flex-shrink-0">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-slate-900 dark:text-vscode-gray-100 flex items-center">
          Interactive Data Explorer
          <span class="text-2xl ml-3" role="img" aria-label="rocket emoji">🚀</span>
          <DarkModeToggle />
          <div class="ml-4 border-l border-slate-300 dark:border-vscode-gray-300 pl-4">
            <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-200 dark:bg-vscode-background">
                <button 
                    class={["px-3 py-1 text-sm font-semibold rounded-md transition-colors", {
                        'bg-white': viewMode === 'table',
                        'dark:bg-vscode-blue': viewMode === 'table'
                    }]}
                    onclick={() => viewMode = 'table'}
                >Table</button>
                <button 
                    class={["px-3 py-1 text-sm font-semibold rounded-md transition-colors", {
                        'bg-white': viewMode === 'plot',
                        'dark:bg-vscode-blue': viewMode === 'plot'
                    }]}
                    onclick={() => {
                        if (plotSpec == '') {
                          plotSpec = getDefaultPlotSpec(queryEngine.tableHeaders.slice(0,1), initialDataset.name + '_view', undefined);
                          viewName = initialDataset.name + '_view';
                        }
                        viewMode = 'plot';
                      }}
                >Plot</button>
            </div>
          </div>
        </h1>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-slate-600 dark:text-vscode-gray-200"
            >Load example:</span>
            {#each exampleDatasets as dataset}
              <button
                class="px-2 py-1 text-xs font-semibold rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-vscode-gray-400 dark:hover:bg-vscode-gray-300 transition-colors"
                onclick={async () => { handleLoadExample(dataset) } }
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
                onkeydown={async (e) => e.key === 'Enter' && handleLoadUrl()}
                placeholder="Or load from URL..."
                class="w-48 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-vscode-background border border-slate-300 dark:border-vscode-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                class="px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-400 dark:disabled:bg-vscode-gray-400"
                onclick={handleLoadUrl}
                disabled={!customUrl || db.isLoading}>Load</button
              >
            </div>
          </div>
        </div>
      </div>
      <p class="text-slate-600 dark:text-vscode-gray-200 mt-1">
        Edit code to transform the data. Click a cell for <code class="bg-slate-200 dark:bg-vscode-gray-400 px-1 rounded">filter</code>, or click headers to select columns.
      </p>
    </header>

    <div class="flex-grow flex gap-2 min-h-0">
      <!-- Main Content -->
      <main class="flex-grow flex flex-col min-h-0 min-w-0">
        {#if viewMode === 'table'}
          <CollapsibleEditor>
            {#snippet top()}
              <EditorPanel bind:queryString={queryEngine.queryString} sqlQuery={queryEngine.sqlQuery} />
            {/snippet}
            {#snippet bottom()}
              <DataTable
                tableData={queryEngine.tableData}
                bind:tableHeaders={queryEngine.tableHeaders}
                isLoadingQuery={queryEngine.isLoadingQuery}
                queryTime={queryEngine.queryTime}
                bind:scrollContainer={tableScrollContainer}
                {items} queryString={queryEngine.queryString}
                setQuery={queryEngine.setQuery}
                tcount={queryEngine.tcount}
                onscroll={queryEngine.handleScroll}
              />
            {/snippet}
          </CollapsibleEditor>
        {:else if viewMode === 'plot'}
            <PlotView bind:spec={plotSpec} {viewName} />
        {/if}
      </main>

      <!-- Shortcut Ribbon -->
      <ShortcutRibbon {shortcuts} />
    </div>
  </div>
{/if}
