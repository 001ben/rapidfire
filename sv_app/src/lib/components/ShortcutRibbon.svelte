<script lang="ts">
    let { shortcuts } = $props();
    let isRibbonOpen = $state(false);
</script>

<aside class="group relative flex-shrink-0 w-16 z-10">
    <div
        class="absolute top-0 right-0 h-full transition-all duration-300 ease-in-out pl-2 pr-2 pb-2 rounded-lg"
        class:w-48={isRibbonOpen || undefined}
        class:w-16={!isRibbonOpen || undefined}
        class:group-hover:w-48={!isRibbonOpen || undefined}
    >
        <div class="space-y-2 pt-12">
            {#each shortcuts as shortcut (shortcut.key)}
                <button
                    class="w-full flex items-center justify-center p-2 rounded-md text-left transition-colors bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
                    onclick={() => shortcut.action()}
                >
                    <span
                        class="flex-grow text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap overflow-hidden
                            transition-all duration-300 ease-in-out group-hover:max-w-full group-hover:opacity-100"
                        class:max-w-full={isRibbonOpen || undefined}
                        class:opacity-100={isRibbonOpen || undefined}
                        class:max-w-0={!isRibbonOpen || undefined}
                        class:opacity-0={!isRibbonOpen || undefined}
                    >
                        {shortcut.label}
                    </span>
                    <kbd class="font-sans font-semibold bg-slate-200 border border-slate-300
                            rounded px-1.5 py-0.5 text-xs dark:bg-slate-600 dark:border-slate-500 dark:text-slate-200">{shortcut.key}</kbd>
                </button>
            {/each}
        </div>
    </div>
    <!-- This is the button that should stay fixed in line with the collapsed ribbon -->
    <div class="absolute top-2 left-1/2 -translate-x-1/2 z-20">
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
</aside>
