<script lang="ts">
    import CodeMirror from "svelte-codemirror-editor";
    import { javascript } from "@codemirror/lang-javascript";
    import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
    import { onMount } from "svelte";
    import { isDarkMode } from "$lib/logic/darkmode.svelte";
    import CollapsibleEditor from "$lib/components/CollapsibleEditor.svelte";

    let vgp: any;
    let vgLoaded = $state(false);

    onMount(async () => {
      vgp = await import("@uwdata/vgplot");
      vgLoaded = true;
    });

    let { spec = $bindable(), viewName } = $props();

    let plotContainer: HTMLElement;
    let plot_width = $state(0);
    let plot_height = $state(0);
    let specEditorHeight = $state(192); // Default height in pixels (h-48)

    let isResizing = $state(false);

    function startResize(event: MouseEvent) {
        event.preventDefault();
        isResizing = true;
        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
    }

    function doResize(event: MouseEvent) {
        if (!isResizing) return;
        // Adjust height, with constraints for min/max size
        specEditorHeight = Math.max(80, Math.min(600, specEditorHeight + event.movementY));
    }

    function stopResize() {
        isResizing = false;
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
    }

    $effect(() => {
        if(!vgLoaded) return;
        if (!plotContainer || !spec || plot_width === 0 || plot_height === 0 || !vgp) return;
        try {
            let width = $state.snapshot(plot_width);
            let height = $state.snapshot(plot_height) - 50;
            const vg = vgp;
            if(vg.namedPlots.has(viewName + "_plot")) {
                vg.namedPlots.delete(viewName + "_plot")
            }
            const plot = eval(spec);
            plotContainer.replaceChildren(plot);
        } catch (e) {
            console.error("Error rendering plot:", e);
            plotContainer.innerHTML = `<div class="p-4 text-red-500">Error rendering plot: ${e instanceof Error ? e.message : String(e)}</div>`;
        }
    });
</script>

<CollapsibleEditor>
    {#snippet top()}
        <CodeMirror
            class="w-full h-full bg-white dark:bg-slate-800"
            bind:value={spec}
            lang={javascript()}
            theme={isDarkMode.dark ? vscodeDark : vscodeLight}
        />
    {/snippet}
    {#snippet bottom()}
    <div
        bind:this={plotContainer} 
        bind:clientWidth={plot_width}
        bind:clientHeight={plot_height}
        class="flex-grow rounded-lg shadow-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 p-4 overflow-auto"
    >
        <!-- Plot will be rendered here -->
    </div>
    {/snippet}
</CollapsibleEditor>
