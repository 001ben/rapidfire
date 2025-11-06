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
        class="grow rounded-lg shadow-md bg-white dark:bg-vscode-background p-4 overflow-auto"
    >
        <!-- Plot will be rendered here -->
    </div>
    {/snippet}
</CollapsibleEditor>
