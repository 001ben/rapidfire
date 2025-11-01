<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { EditorView } from "@codemirror/view"
  import { javascript } from "@codemirror/lang-javascript";
  import { sql } from "@codemirror/lang-sql";
  import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
  import { isDarkMode  } from "$lib/logic/darkmode.svelte";

  let { queryString = $bindable(), sqlQuery } = $props();

  let showSqlEditor = $state(true);
  let view = $state<EditorView | undefined>();

  $effect(() => {
    let newView = view;
    if (view) {
      view.dom.classList.add("h-full");
    }
  });

</script>

<div
  id="editor-container"
  class="relative flex flex-shrink-0 h-full rounded-lg shadow-md overflow-hidden border border-slate-300 dark:border-vscode-gray-300"
>
  <button
    onclick={() => (showSqlEditor = !showSqlEditor)}
    class="absolute top-2 z-10 p-1 rounded bg-slate-100/50 hover:bg-slate-200 dark:bg-vscode-background/50 dark:hover:bg-vscode-gray-400/50 text-xs font-mono"
    class:right-2={!showSqlEditor}
    class:right-6={showSqlEditor}
    title="Toggle SQL View"
  >
    SQL
  </button>
    <div class={{'w-1/2': showSqlEditor, 'w-full': !showSqlEditor, "h-full transition-all duration-300": true}}>
    <CodeMirror
      class="w-full h-full bg-white dark:bg-vscode-background"
      bind:value={queryString}
      lang={javascript()}
      theme={isDarkMode.dark ? vscodeDark : vscodeLight }
      onready={(cm_view) => view = cm_view}
      lineNumbers={false}
      foldGutter={false}
      highlight={{
        activeLine: false,
        activeLineGutter: false
      }}
    />
  </div>
  {#if showSqlEditor}
    <div class="h-full w-1/2 border-l border-slate-300 dark:border-vscode-gray-300 overflow-scroll border-l-4">
      <CodeMirror 
        class="w-full h-full bg-slate-50 dark:bg-vscode-background" 
        value={sqlQuery} 
        lang={sql()}
        theme={isDarkMode.dark ? vscodeDark : vscodeLight} 
        readonly={true}
        lineNumbers={false}
        foldGutter={false}
        highlight={{
          activeLine: false,
          activeLineGutter: false
        }}
        />
    </div>
  {/if}
</div>