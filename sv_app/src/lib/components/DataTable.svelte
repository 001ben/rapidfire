<script lang="ts">
    let {
        tableData,
        tableHeaders = $bindable([]),
        isLoadingQuery,
        queryTime,
        scrollContainer = $bindable(),
        tcount,
        ...restProps
    } = $props();

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

  function getTextColorForType(type: string): string {
    switch (type) {
        case 'Int':
            return 'text-cyan-600 dark:text-cyan-400 font-medium';
        case 'Float':
        case 'Decimal':
            return 'text-blue-600 dark:text-blue-400 font-medium';
        case 'Bool':
            return 'text-purple-600 dark:text-purple-400 font-medium';
        case 'Date':
        case 'Time':
        case 'Timestamp':
            return 'text-amber-600 dark:text-amber-400';
        case 'Utf8':
        case 'LargeUtf8':
        case 'Utf8View':
        case 'Dictionary': // Often represents categorical strings
            return 'text-green-600 dark:text-green-500';
        default:
            return '';
    }
  }
</script>

<svelte:window onmouseup={() => isDragging = false} />
<div
    id="table-container" class="flex flex-col flex-grow min-h-0 rounded-lg shadow-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 mt-4 relative"
    {...restProps}
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
    <div class="overflow-auto" onscroll={restProps['onscroll']} bind:this={scrollContainer}>
        <table id="data-table" class="min-w-full text-sm border-separate border-spacing-0">
            <thead class="sticky top-0 z-10">
            <tr>
                {#each tableHeaders as header, index}
                <th class="p-3 text-left tracking-wider cursor-pointer 
                           text-slate-700 dark:text-slate-300"
                    class:bg-slate-200={!header.selected}
                    class:bg-blue-200={header.selected}
                    class:hover:bg-slate-300={!header.selected}
                    class:hover:bg-blue-300={header.selected}
                    class:dark:bg-slate-600={!header.selected}
                    class:dark:bg-blue-800={header.selected}
                    class:dark:hover:bg-slate-700={!header.selected}
                    class:dark:hover:bg-blue-900={header.selected}
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
                {#each tableData as row, i (i)}
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    {#each Object.values(row) as val, colIndex}
                        <td class="p-3 whitespace-nowrap font-mono">
                            <span class:text-slate-400={val === null} class:dark:text-slate-500={val === null}
                                  class={getTextColorForType(tableHeaders[colIndex].type)}>{String(val)}</span>
                        </td>
                    {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    {:else if !isLoadingQuery}
    <p class="p-4 text-center text-slate-500">No data to display.</p>
    {:else}
    <div class="p-4 text-center text-slate-500">Loading...</div>
    {/if}
</div>