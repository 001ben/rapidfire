<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { sql } from "@codemirror/lang-sql";
  import { vsCodeDark } from "@fsegurai/codemirror-theme-vscode-dark";

  let { queryString = $bindable(), sqlQuery, isDarkMode } = $props();

  let showSqlEditor = $state(true);
  let view = $state<EditorView>();

  $effect(() => {
    let newView = view;
    if (view) {
      view.dom.classList.add("h-full");
    }
  });

</script>

<div
  id="editor-container"
  class="relative flex flex-shrink-0 h-56 md:h-64 rounded-lg shadow-md overflow-hidden border border-slate-300 dark:border-slate-700"
>
  <button
    onclick={() => (showSqlEditor = !showSqlEditor)}
    class="absolute top-2 z-10 p-1 rounded bg-slate-100/50 hover:bg-slate-200 dark:bg-slate-900/50 dark:hover:bg-slate-700 text-xs font-mono"
    class:right-2={!showSqlEditor}
    class:right-6={showSqlEditor}
    title="Toggle SQL View"
  >
    SQL
  </button>
    <div class={{'w-1/2': showSqlEditor, 'w-full': !showSqlEditor, "h-full transition-all duration-300": true}}>
    <CodeMirror
      class="w-full h-full bg-white dark:bg-slate-800"
      bind:value={queryString}
      lang={javascript()}
      themes={isDarkMode ? [vsCodeDark] : []}
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
    <div class="h-full w-1/2 border-l border-slate-300 dark:border-slate-600 overflow-scroll border-l-4">
      <CodeMirror 
        class="w-full h-full bg-slate-50 dark:bg-slate-800" 
        value={sqlQuery} 
        lang={sql()}
        themes={isDarkMode ? [vsCodeDark] : []} 
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