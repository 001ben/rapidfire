<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { sql } from "@codemirror/lang-sql";
  import { vsCodeDark } from "@fsegurai/codemirror-theme-vscode-dark";

  let { queryString, sqlQuery, isDarkMode } = $props();

  let showSqlEditor = $state(true);
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
    />
  </div>
  {#if showSqlEditor}
    <div class="h-full w-1/2 border-l border-slate-300 dark:border-slate-600 overflow-scroll">
      <CodeMirror class="w-full h-full bg-slate-50 dark:bg-slate-800/50" value={sqlQuery} lang={sql()} themes={isDarkMode ? [vsCodeDark] : []} readonly={true} />
    </div>
  {/if}
</div>