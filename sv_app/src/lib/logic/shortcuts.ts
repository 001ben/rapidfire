import type { StateHistory } from "runed";
import type { useDataExplorer } from "./useDataExplorer.svelte";
import { addCount, addDistinct, addGroupBy, addSelect, addCast, addSort } from "$lib/logic/actions";
import { getDefaultPlotSpec } from "./plots";
import type { ViewState } from "./types";

type DataExplorer = ReturnType<typeof useDataExplorer>;

export class ShortcutsManager {
	#data: DataExplorer;
	#view: ViewState;

	constructor(dataExplorer: DataExplorer, viewState: ViewState) {
		this.#data = dataExplorer;
		this.#view = viewState;
	}

	get shortcuts() {
		return [
			{ key: 's', label: 'select', action: this.#select },
			{ key: 'g', label: 'group count', action: this.#groupBy },
			{ key: 'd', label: 'distinct', action: this.#distinct },
			{ key: 'c', label: 'count', action: this.#count },
			{ key: 'p', label: 'plot', action: this.#togglePlot },
			{ key: 'z', label: 'undo', action: this.#undo },
			{ key: 'Z', label: 'redo', action: this.#redo },
			{ key: 'q', label: 'log query', action: this.#logQuery },
			{ key: 'r', label: 'reset', action: this.#reset }
		];
	}

	#reset = () => {
		this.#data.resetQuery(`return XQL.from('${this.#data.activeDataset.name}')`);
	};

	#undo = () => this.#data.queryHistory.undo();
	#redo = () => this.#data.queryHistory.redo();

	#togglePlot = async () => {
		if (this.#view.mode === 'plot') {
			this.#view.mode = 'table';
			return;
		}
		const viewName = this.#data.activeDataset.name + '_view';
		await this.#data.rawExecSQL(`CREATE OR REPLACE VIEW ${viewName} AS ${this.#data.query.toSQL()}`);
		await this.#data.clearVGCachedData();

		this.#view.plotSpec = getDefaultPlotSpec(this.#data.selectedColumns, viewName, this.#data.colorColumn);
		this.#view.viewName = viewName;
		this.#view.mode = 'plot';
	};

	#select = () => {
		addSelect(this.#data.queryString, this.#data.setQuery, this.#data.selectedColumnNames);
	};

	#groupBy = () => {
		addGroupBy(this.#data.queryString, this.#data.setQuery, this.#data.selectedColumnNames);
	};

	#distinct = () => {
		addDistinct(this.#data.queryString, this.#data.setQuery, this.#data.selectedColumnNames);
	};

	#count = () => addCount(this.#data.queryString, this.#data.setQuery);

	#logQuery = () => console.log(this.#data.queryString);
}