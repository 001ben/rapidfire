<script lang="ts">
  // Page component logic (if any)
  import DarkModeToggle from "$lib/components/DarkModeToggle.svelte";
  import ShortcutRibbon from "$lib/components/ShortcutRibbon.svelte";
  import DataTable from "$lib/components/DataTable.svelte";
  import EditorPanel from "$lib/components/EditorPanel.svelte";
  import PlotView from "$lib/components/PlotView.svelte";
  import ExpressionBuilderModal from "$lib/components/ExpressionBuilderModal.svelte";

  import { getDefaultPlotSpec } from '$lib/logic/plots';
  import CollapsibleEditor from "$lib/components/CollapsibleEditor.svelte";
  import { useDataExplorer } from "$lib/logic/useDataExplorer.svelte";
  import { onMount } from "svelte";

  import { ShortcutsManager } from '$lib/logic/shortcuts';
  import DatasetSelector from "$lib/components/DatasetSelector.svelte";
  import type {ViewState} from "$lib/logic/types"

  const data = useDataExplorer();
  const view = $state<ViewState>({
    mode: 'table' as 'table' | 'plot',
    plotSpec: '',
    viewName: '',
    isExpressionBuilderOpen: false
  });
  const shortcutManager = new ShortcutsManager(data, view);
  
  onMount(async () => {
    data.initialise();
    shortcutManager.initialise();
  });
  
  let tableScrollContainer = $state<HTMLElement | undefined>(undefined);
  $effect(() => {
    data.setScrollContainer(tableScrollContainer);
  });
</script>

{#if data.dbError}
  <div class="p-4 bg-red-100 text-red-800 h-screen flex items-center justify-center">
    <strong>Fatal Error:</strong> Could not load database. {data.dbError}
  </div>
{:else if !data.isDbReady}
  <div class="p-4 text-center h-screen flex items-center justify-center">
    <p class="text-2xl text-slate-500">Initializing Database...</p>
  </div>
{:else}
  <div class="bg-slate-100 text-slate-800 dark:bg-vscode-background dark:text-vscode-foreground flex flex-col h-screen p-4 md:p-6 lg:p-8 box-border">
    <header class="mb-4 shrink-0">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-slate-900 dark:text-vscode-gray-100 flex items-center">
          Interactive Data Explorer
          <span class="text-2xl ml-3" role="img" aria-label="rocket emoji">🚀</span>
          <DarkModeToggle />
          <div class="ml-4 border-l border-slate-300 dark:border-vscode-gray-300 pl-4">
            <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-200 dark:bg-vscode-background">
                <button 
                    class={["px-3 py-1 text-sm font-semibold rounded-md transition-colors", {
                        'bg-white': view.mode === 'table',
                        'dark:bg-vscode-blue': view.mode === 'table'
                    }]}
                    onclick={() => view.mode = 'table'}
                >Table</button>
                <button 
                    class={["px-3 py-1 text-sm font-semibold rounded-md transition-colors", {
                        'bg-white': view.mode === 'plot',
                        'dark:bg-vscode-blue': view.mode === 'plot'
                    }]}
                    onclick={() => {
                        if (view.plotSpec == '') {
                          view.plotSpec = getDefaultPlotSpec(data.tableHeaders.slice(0,1), data.activeDataset.name + '_view', undefined);
                          view.viewName = data.activeDataset.name + '_view';
                        }
                        view.mode = 'plot';
                      }}
                >Plot</button>
            </div>
          </div>
        </h1>
        <DatasetSelector 
          handleLoadUrl={data.loadCustomUrl}
          handleLoadExample={data.importDataset} 
          handleLoadFile={data.loadFile}
          isLoading={data.isLoadingQuery} />
      </div>
      <p class="text-slate-600 dark:text-vscode-gray-200 mt-1">
        Edit code to transform the data. Click a cell for <code class="bg-slate-200 dark:bg-vscode-gray-400 px-1 rounded">filter</code>, or click headers to select columns.
      </p>
    </header>

    <div class="grow flex gap-2 min-h-0">
      <!-- Main Content -->
      <main class="grow flex flex-col min-h-0 min-w-0">
        {#if view.mode === 'table'}
          <CollapsibleEditor>
            {#snippet top()}
              <EditorPanel bind:queryString={data.queryString} sqlQuery={data.sqlQuery} />
            {/snippet}
            {#snippet bottom()}
              {#if data.queryError}
              <div class="p-4 bg-red-100 text-red-800 h-4 flex items-center justify-center">
                <strong>Query Error:</strong> {data.queryError}
              </div>
              {/if}
              <DataTable
                tableData={data.tableData}
                bind:tableHeaders={data.tableHeaders}
                isLoadingQuery={data.isLoadingQuery}
                queryTime={data.queryTime}
                bind:scrollContainer={tableScrollContainer}
                items={shortcutManager.items}
                tcount={data.tcount}
                onscroll={data.handleScroll}
              />
              <div class="absolute top-2 right-36">
                <button 
                  class="px-3 py-1 text-sm font-semibold rounded-md transition-colors bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                  onclick={() => view.isExpressionBuilderOpen = true}
                >f(x) Add Column</button>
              </div>
            {/snippet}
          </CollapsibleEditor>
        {:else if view.mode === 'plot'}
            <PlotView bind:spec={view.plotSpec} viewName={view.viewName} />
        {/if}
      </main>

      <!-- Shortcut Ribbon -->
      <ShortcutRibbon shortcuts={shortcutManager.shortcuts} />
    </div>
  </div>

  <ExpressionBuilderModal 
    bind:show={view.isExpressionBuilderOpen}
    onClose={() => view.isExpressionBuilderOpen = false}
    {data}
    initialiseColumn={() => data.tableHeaders[0]?.name}
  />
{/if}
