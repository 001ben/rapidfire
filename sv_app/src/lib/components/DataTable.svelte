<script lang="ts">

    import RadialMenu from './RadialMenu.svelte';

    let {
        tableData,
        tableHeaders = $bindable([]),
        isLoadingQuery,
        queryTime,
        scrollContainer = $bindable(),
        items,
        queryString,
        setQuery,
        tcount,
        ...restProps
    } = $props();

  let isDragging = $state(false);
  let dragSelectionState = $state(false);
  let isRadialInteraction = $state(false); // Flag to track the interaction
  let menu = $state({
    open: false,
    x: 0,
    y: 0,
    header: null,
    items: []
  });

  function handleHeaderMouseDown(index: number, event: MouseEvent) {
    event.preventDefault();

    const activeEl = document.activeElement as HTMLElement;
    if (activeEl?.classList.contains('cm-content')) {
      activeEl.blur();
    }

    if (event.altKey) {
      // Alt-click toggles the color column
      const isCurrentlyColor = tableHeaders[index].isColorColumn;
      // First, deselect any other color column
      tableHeaders.forEach(h => h.isColorColumn = false);
      // Then, toggle the clicked one
      tableHeaders[index].isColorColumn = !isCurrentlyColor;
      // A color column cannot also be an axis column
      if (tableHeaders[index].isColorColumn) {
        tableHeaders[index].selected = false;
      }
    } else {
      // Normal click handles axis selection
      isDragging = true;
      const initialSelected = !tableHeaders[index].selected;
      dragSelectionState = initialSelected;
      tableHeaders[index].selected = initialSelected;
      tableHeaders[index].isColorColumn = false; // Cannot be both
    }
  }

  function handleHeaderMouseEnter(index: number) {
    if (isDragging) {
      tableHeaders[index].selected = dragSelectionState;
    }
  }

  function handleRightMouseDown(event: MouseEvent, header) {
    event.preventDefault();
    isRadialInteraction = true;

    menu = {
      open: true,
      x: event.clientX,
      y: event.clientY,
      header: header,
      items: items
    };
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

{#if menu.open}
    <RadialMenu
        items={menu.items}
        x={menu.x}
        y={menu.y}
        onSelect={(item) => { 
          if (item.action) item.action(menu.header);
          menu.open = false;
        }}
        onClose={() => menu.open = false}
    />
{/if}

<svelte:window
    onmouseup={() => isDragging = false}
    oncontextmenu={(e) => {
        // If this contextmenu event is part of our radial interaction, prevent it.
        if (isRadialInteraction) {
            e.preventDefault();
            isRadialInteraction = false; // Reset the flag after the interaction is complete.
        }
    }}
/>
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
                    onmousedown={(e) => {
                      if (e.button === 2) { // Right-click
                        handleRightMouseDown(e, header);
                      } else {
                        handleHeaderMouseDown(index, e);
                      }
                    }}
                    onmouseenter={() => handleHeaderMouseEnter(index)}
                    oncontextmenu={(e) => e.preventDefault()}>
                    <div class="flex flex-col">
                    <span class="font-bold">{header.name}</span>
                    <div class="flex flex-row">
                        <span class="self-start font-semibold {getTextColorForType(header.type)} border rounded-r-xl px-1 text-xs">
                            {header.type}
                        </span>
                        {#if header.isColorColumn}
                          <span class="self-start font-semibold text-red-700 border rounded-r-xl px-1 text-xs ml-1">
                            colour
                          </span>
                        {/if}
                    </div>
                    </div>
                </th>
                {/each}
            </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700 bg-slate-50">
                {#each tableData as row, i (i)}
                    <tr class="hover:bg-slate-300 dark:hover:bg-slate-700/50" class:bg-slate-200={i % 2 === 1}>
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