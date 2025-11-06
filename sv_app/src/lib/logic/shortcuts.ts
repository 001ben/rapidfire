import { addCount, addDistinct, addGroupBy, addSelect, addCast, addSort } from "$lib/logic/actions";
import { getDefaultPlotSpec } from "./plots";
import { getNotificationsContext } from 'svelte-notifications';
import type { DataExplorer, ViewState, TableHeader } from "./types";
import type { addNotification } from 'svelte-notifications';

export class ShortcutsManager {
	#data: DataExplorer;
	#view: ViewState;
  #addNotification: addNotification | undefined;

	constructor(dataExplorer: DataExplorer, viewState: ViewState) {
		this.#data = dataExplorer;
		this.#view = viewState;
	}

  initialise() {
    this.#addNotification = getNotificationsContext().addNotification;
  }

  get items() {
    return [
      {
        label: "Cast",
        children: [
          { label: "to String", action: this.#addCastFunction("STRING") },
          { label: "to Integer", action: this.#addCastFunction("INTEGER") },
          { label: "to Float", action: this.#addCastFunction("FLOAT") },
          { label: "to Decimal", action: this.#addCastFunction("DECIMAL") },
          { label: "to Date", action: this.#addCastFunction("DATE") },
        ],
      },
      {
        label: "Sort",
        children: [
          { label: "Ascending", action: this.#addSortFunction('asc') },
          { label: "Descending", action: this.#addSortFunction('desc') },
        ],
      },
      {
        label: "Copy Name", action: async (header: TableHeader) => {
          if (!navigator.clipboard) return;
          try {
            await navigator.clipboard.writeText(header.name);
            if (!this.#addNotification) return;
            this.#addNotification({
              text: `Copied "${header.name}" to clipboard.`,
              position: 'bottom-right',
              type: "success",
              removeAfter: 2000,
            });
          } catch (err) {
            console.error("Failed to copy: ", err);
          }
        }
      }
    ];
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

  #addCastFunction(dataType: string) {
    return (header: TableHeader) => addCast(this.#data.queryString, this.#data.setQuery, header.name, dataType);
  }
  
  #addSortFunction(direction: 'asc' | 'desc') {
    return (header: TableHeader) => addSort(this.#data.queryString, this.#data.setQuery, header.name, direction)
  }
}