<script lang="ts">
    import CodeMirror from "svelte-codemirror-editor";
    import { javascript } from "@codemirror/lang-javascript";
    import { vsCodeDark } from "@fsegurai/codemirror-theme-vscode-dark";
    // import * as vg from "@uwdata/vgplot";
    import { onMount } from "svelte";

    let vgp;
    let vgLoaded = $state(false);

    onMount(async () => {
      vgp = await import("@uwdata/vgplot");
      vgLoaded = true;
    });

    let { spec = $bindable(), isDarkMode } = $props();

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
            const plot = eval(spec);
            plotContainer.replaceChildren(plot);
        } catch (e) {
            console.error("Error rendering plot:", e);
            plotContainer.innerHTML = `<div class="p-4 text-red-500">Error rendering plot: ${e.message}</div>`;
        }
    });
</script>

<div class="flex flex-col h-full gap-4">
    <div class="flex-shrink-0 h-48 rounded-lg shadow-md overflow-scroll border border-slate-300 dark:border-slate-700">
        <CodeMirror
            class="w-full h-full bg-white dark:bg-slate-800"
            bind:value={spec}
            lang={javascript()}
            themes={isDarkMode ? [vsCodeDark] : []}
        />
    </div>
    <div 
        bind:this={plotContainer} 
        bind:clientWidth={plot_width}
        bind:clientHeight={plot_height}
        class="flex-grow rounded-lg shadow-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 p-4 overflow-auto"
    >
        <!-- Plot will be rendered here -->
    </div>
</div>
