<script lang="ts">
  import type { Snippet } from 'svelte';
  let { top, bottom }: { top: Snippet, bottom: Snippet } = $props();
  // --- Resizer Logic ---
  let isResizing = $state(false);
  let editorHeight = $state(224); // Default height in pixels (h-56)
  let heightBeforeCollapse = $state(224);

  function startResize(event: MouseEvent) {
    event.preventDefault();
    isResizing = true;
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  }

  function doResize(event: MouseEvent) {
    if (!isResizing) return;

    const newHeight = editorHeight + event.movementY;

    if (newHeight < 20) { // Threshold to collapse
      if (editorHeight !== 0) {
        heightBeforeCollapse = editorHeight;
      }
      editorHeight = 0;
    } else {
        editorHeight = Math.max(40, Math.min(600, newHeight));
    }
  }

  function stopResize() {
    isResizing = false;
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResize);
  }

  function toggleCollapse() {
    console.log("editorHeight: ", editorHeight);
    if (editorHeight > 0) {
      heightBeforeCollapse = editorHeight;
      editorHeight = 0;
    } else {
      editorHeight = heightBeforeCollapse > 40 ? heightBeforeCollapse : 224;
    }
  }
</script>

<div class="grow flex flex-col min-h-0 min-w-0">
  {#if editorHeight > 0}
  <div style:height="{editorHeight}px" class="shrink-0 overflow-auto">
      {@render top()}
  </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onmousedown={startResize}
    class="relative shrink-0 h-2 cursor-row-resize group w-full"
    title="Drag to resize editor"
  >
    <div
      class="w-full h-full bg-slate-200 group-hover:bg-blue-400 dark:bg-vscode-gray-400/30 dark:group-hover:bg-vscode-blue transition-colors"
      class:bg-blue-500={isResizing}
    ></div>
    <button
      onclick={toggleCollapse}
      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-4 rounded-full bg-slate-300 dark:bg-vscode-gray-300/80 hover:bg-slate-400 dark:hover:bg-vscode-gray-400 flex items-center justify-center"
      title={editorHeight > 0 ? 'Collapse pane' : 'Expand pane'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-3 h-3 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
        class:rotate-180={editorHeight === 0}
      >
        <polyline points="6 15 12 9 18 15"></polyline>
      </svg>
    </button>
  </div>
  <div class="grow min-h-0 flex flex-col">
    {@render bottom()}
  </div>
</div>