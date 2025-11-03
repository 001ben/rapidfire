<script lang="ts">
import { onMount } from 'svelte';
import { fly, fade } from 'svelte/transition';
import type { Dataset } from "$lib/logic/types";
import { exampleDatasets } from "$lib/logic/data";
import { getNotificationsContext } from 'svelte-notifications';

let { handleLoadUrl, handleLoadExample, handleLoadFile, isLoading }: 
  { handleLoadUrl: (customUrl: string) => void, handleLoadExample: (dataset: Dataset) => void, handleLoadFile: (file: File, arrayBuffer: ArrayBuffer) => void, isLoading: boolean} 
    = $props();

let customUrl = $state("");
const { addNotification } = getNotificationsContext();

// --- Animated Button Text ---
const buttonTexts = [{cls:'text-green-500', text: 'XLSX'}, {cls: 'text-yellow-500', text: 'CSV'}, {cls: 'text-red-200', text: 'Parquet'}];
let currentTextIndex = $state(0);
let buttonText = $derived(buttonTexts[currentTextIndex]);
let intervalCycles = $state(12);
let intervalId: any = null; // Store interval ID

/**
 * Starts the animation cycle.
 * Resets cycle count and sets up the interval.
 */
function startAnimation() {
    // Clear any existing interval to avoid duplicates
    if (intervalId) {
        clearInterval(intervalId);
    }
    
    // Reset cycle count
    intervalCycles = 12;

    intervalId = setInterval(() => {
        // Stop cycling if we've reached the limit
        if (intervalCycles <= 0) {
            clearInterval(intervalId); // Stop the interval
            intervalId = null; // Mark as not running
            return;
        }
        
        currentTextIndex = (currentTextIndex + 1) % buttonTexts.length;
        intervalCycles = intervalCycles - 1; // Decrement remaining cycles
    }, 3000); // Cycle text every 3 seconds
}

/**
 * Handles user interaction (hover/click) on the button.
 * Restarts the animation if it's stopped, or resets the cycle count if it's running.
 */
function handleButtonInteraction() {
    if (!intervalId) {
        // If animation is stopped, start it again
        startAnimation();
    } else {
        // If it's already running, just reset the cycle counter
        intervalCycles = 12;
    }
}

async function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    await handleLoadFile(file, data);
  } catch (e) {
    console.error(e);
    addNotification({
      text: `Error uploading file "${file.name}" - ${e instanceof Error ? e.message : String(e)}`,
      position: 'bottom-right',
      type: "error",
      removeAfter: 3000,
    })
  }
}

onMount(() => {
  startAnimation()
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }
});
</script>

<div class="flex items-center gap-4">
  <div class="flex items-center gap-2 flex-wrap">
    <span class="text-sm font-medium text-slate-600 dark:text-vscode-gray-200"
    >Load example:</span>
    {#each exampleDatasets as dataset}
      <button
        class="px-2 py-1 text-xs font-semibold rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
        onclick={async () => { handleLoadExample(dataset) } }
        >
        {dataset.name}
      </button>
    {/each}
  </div>
  <div class="maw-w-sm">
    <label 
      for="data_upload" 
      class="cursor-pointer px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-500 text-white hover:bg-blue-600 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center gap-1.5"
      onmouseenter={handleButtonInteraction}
    >
      Upload
      <span class="inline-grid text-left overflow-hidden h-5 w-16">
        {#key buttonText}
          <span in:fly={{ y: -15, duration: 300, delay: 300 }} out:fly={{ y: 15, duration: 300 }} class={buttonText.cls}>
            {buttonText.text}
          </span>
        {/key}
      </span>
    </label>
    <input type="file" id="data_upload" accept=".xlsx, .csv, .parquet" onchange={handleFileSelect}  class="hidden" />
  </div>
  <div class="max-w-sm grow">
    <div class="flex items-center gap-2">
      <input
        type="text"
        bind:value={customUrl}
        onkeydown={async (e) => e.key === 'Enter' && handleLoadUrl(customUrl)}
        placeholder="Or load from URL..."
        class="w-48 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-vscode-background border border-slate-300 dark:border-vscode-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      <button
        class="px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-400 dark:disabled:bg-vscode-gray-400"
        onclick={() => handleLoadUrl(customUrl)}
        disabled={!customUrl || isLoading}>Load</button
      >
    </div>
  </div>
</div>