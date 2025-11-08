<script lang="ts">
	import type { useDataExplorer } from '$lib/logic/useDataExplorer.svelte';
	import { type Table as ArrowTable } from 'apache-arrow';
	import { onMount, tick, onDestroy } from 'svelte';
	import CodeMirror from 'svelte-codemirror-editor';
	import { javascript } from '@codemirror/lang-javascript';
	import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
	import { isDarkMode } from '$lib/logic/darkmode.svelte';
	import DataTable from './DataTable.svelte';

	let {
		show = $bindable(),
		onClose,
		data,
		initialiseColumn
	}: {
		show: boolean;
		onClose: () => void;
		data: ReturnType<typeof useDataExplorer>;
		initialiseColumn: () => string;
	} = $props();

	let conn: any;
	let previewTableReady = $state<boolean>(false);
	$effect(() => {
		if(show) {
			tick().then(() => modalElement?.focus());
			data.getConn().then(async (c) => {
				console.log("conn", c);
				conn = c;
				console.log("attempting create table preview sample")
				console.log(` 
					CREATE OR REPLACE TEMP VIEW preview_sample AS
					${data.sqlQuery}
					LIMIT 20;
				`)
				await conn?.send(` 
					CREATE OR REPLACE TEMP VIEW preview_sample AS
					${data.sqlQuery};
				`);
				console.log("preview sample ready")
				expression = `c("${initialiseColumn()}").alias("new_column")`;
				previewTableReady = true;
			});
		} else {
			conn?.close()
			conn = null;
		}
	})

	let expression = $state("");
	let newColumnName = $state('new_column');

	let previewTable = $state<ArrowTable | null>(null);
	let expressionError = $state<string | null>(null);
	let previewIsLoading = $state(false);
	let tableHeaders = $state<any[] | undefined>([]);

	$effect(() => {
		if (!expression.trim()) {
			previewTable = null;
			expressionError = null;
			return;
		}

		if (!conn || !previewTableReady) {
			expressionError = "Waiting for database...";
			previewTable = null;
			return;
		}

		previewIsLoading = true;
		expressionError = null;

		
		let updateTable = async () => {
			try {
				// regex search for any strings inside c("")
				console.log("full XQL", `return XQL.from("preview_sample").with_columns(${expression})`)
				const sqlQuery = data.createQuery(`return XQL.from("preview_sample").with_columns(${expression})`)
				// Try to apply the new expression to the sample
				console.log("sql query!", sqlQuery.toSQL())
				let preview = await conn?.query(sqlQuery.toSQL())
				console.log("preview ran!", preview)
				// this logic should all probably be moved to the useDataExplorer file
				tableHeaders = data?.extractTableHeaders(preview);
				previewTable = data?.db?.aq.fromArrow(preview);
				console.log("preview ran table!", previewTable)
			} catch (e: any) {
				expressionError = e.message;
				previewTable = null;
			} finally {
				previewIsLoading = false;
			}
		}
		updateTable();
	});

	function applyExpression() {
		if (!expression.trim() || !newColumnName.trim()) return;

		const newQuery = `${data.queryString}\n  .with_columns(${expression}})`;
		data.setQuery(newQuery);
		onClose();
	}
	
	// svelte-ignore non_reactive_update
	let modalElement: HTMLDivElement | null = null;
</script>

{#if show}
	<div bind:this={modalElement}
		class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="dialog" tabindex="-1"
		aria-modal="true"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-[90vw] h-[90vh] max-w-6xl flex flex-col p-6"
			onclick={(e) => e.stopPropagation()} role="document"
		>
			<h2 class="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Expression Builder</h2>

			<div class="grid grid-cols-2 gap-4 grow min-h-0">
				<!-- Left Panel: Editor & Helpers -->
				<div class="flex flex-col gap-4">
					<div>
						<label for="new-col-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300"
							>New Column Name</label
						>
						<input
							type="text"
							id="new-col-name"
							bind:value={newColumnName}
							class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-slate-700"
						/>
					</div>
					<div>
						<label for="expression-editor" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Expression</label>
						<div id="expression-editor" class="h-48 border dark:border-slate-600 rounded-md mt-1">
							<CodeMirror
								class="w-full h-full"
								bind:value={expression}
								lang={javascript()}
								theme={isDarkMode.dark ? vscodeDark : vscodeLight}
							/>
						</div>
					</div>
					<!-- TODO: Helpers & Hotkeys -->
					<div class="text-slate-600 dark:text-slate-400">Helpers coming soon...</div>
				</div>

				<!-- Right Panel: Live Preview -->
				<div class="flex flex-col min-h-0">
					<h3 class="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">Live Preview</h3>
					{#if expressionError}
						<div class="p-4 bg-red-100 text-red-800 rounded-md"><strong>Error:</strong> {expressionError}</div>
					{:else}
						<div class="grow border dark:border-slate-600 rounded-md overflow-hidden">
							<DataTable 
								tableData={previewTable}
								bind:tableHeaders={tableHeaders}
								isLoadingQuery={previewIsLoading} 
								items={[]}
								queryTime={0}
								tcount={previewTable?.numRows ?? 0} />
						</div>
					{/if}
				</div>
			</div>

			<footer class="flex justify-end gap-4 mt-6 pt-4 border-t dark:border-slate-700">
				<button class="px-4 py-2 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600" onclick={onClose}>Cancel</button>
				<button class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300" onclick={applyExpression} disabled={!expression.trim() || !!expressionError}>Apply</button>
			</footer>
		</div>
	</div>
{/if}