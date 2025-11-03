import type { StateHistory } from "runed";
import type { TableHeader } from "./useQueryEngine.svelte";
import { addCount, addDistinct, addGroupBy, addSelect } from "$lib/logic/actions";

type ShortcutDependencies = {
    queryString: {
        get: () => string;
    };
    selectedColumns: {
        get: () => TableHeader[];
    };
    selectedColumnNames: {
        get: () => string[];
    };
    colorColumn: {
        get: () => string | undefined;
    };
    currentTableName: () => string,
    createViewCurrentQuery: () => Promise<void>,
    queryHistory: StateHistory<string>;
    reset: () => void;
    setQuery: (q: string) => void;
    currentViewMode: () => 'table' | 'plot';
    setViewMode: (mode: 'table' | 'plot') => void;
    setPlotSpec: (spec: string, viewName: string) => void;
}

export function getDefaultPlotSpec(cols: TableHeader[], viewName: string, fill: string | undefined) {
  console.log("cols", cols);
  if (cols.length === 2 && cols.every(c => ['Int', 'Float', "Decimal"].includes(c.type))) {
    // scatter plot for 2 numerics
  return `
vg.vconcat(
  vg.plot(
    vg.dot(vg.from("${viewName}"), { 
      x: "${cols[0].name}", 
      y: "${cols[1].name}",
      r: 6,
      tip: true,
      ${fill ? `fill: "${fill}",` : ''}
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
    vg.marginLeft(60),
    vg.yLabelAnchor("top")
  ), ${fill ? `
  vg.colorLegend({for: "${viewName}_plot"}),` : ''}
)`
  } else if (cols.length === 1 && ['Int', 'Float', "Decimal"].includes(cols[0].type)) {
    // histogram for 1 number
    let plot_spec = `p
`;
    return `
const $bandwidth = vg.Param.value(20);
vg.vconcat(
  vg.slider({label: "Bandwidth (σ)", as: $bandwidth, min: 0.1, max: 200, step: 0.1}),
  vg.plot(
    vg.densityY(vg.from("${viewName}"), { 
      x: "${cols[0].name}",
      bandwidth: $bandwidth,
      fill: ${fill ? `"${fill}"` : '"steelblue"'},
      opacity: 0.8,
      tip: true,
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
  ), ${ fill ? `
  vg.colorLegend({for: '${viewName}_plot'}),` : ''
  }
)`;
  } else if (cols.length === 1 && ['Date', 'Time', 'Timestamp'].includes(cols[0].type)) {
    // histogram for 1 datetime
    return `
vg.vconcat(
  vg.plot(
    vg.rectY(vg.from("${viewName}"), {
      x: vg.bin("${cols[0].name}"),
      y: vg.count(),
      fill: "${fill ? fill : 'steelblue'}",
      tip: true,
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
  ), ${ fill ? `
  vg.colorLegend({for: '${viewName}_plot'}),` : ''
  }
)`;
  } else {
    // default case - 1 column (or first column) bar bar chart e.g. group count
    return `
vg.vconcat(
  vg.plot(
    vg.barX(vg.from("${viewName}"), { 
      x: vg.count(), 
      y: "${cols[0].name}", 
      fill: "${fill ? fill : cols[0].name}",
      sort: {y: "-x", limit: 25},
      tip: true,
    }),
    vg.name("${viewName}_plot"),
    vg.width(width),
    vg.height(height),
    vg.marginLeft(60),
    vg.yLabelAnchor("top")
  ),
  vg.colorLegend({for: "${viewName}_plot"})
)`;
  }
}

export function createShortcuts({ queryString, selectedColumns, selectedColumnNames, colorColumn, currentTableName, createViewCurrentQuery, queryHistory, reset, setQuery, currentViewMode, setViewMode, setPlotSpec }: ShortcutDependencies) {
    return [
        {
          key: "s",
          label: "select",
          action: () => {
              addSelect(queryString.get(), setQuery, selectedColumnNames.get());
          },
        },
        {
          key: "g",
          label: "group count",
          action: () => {
              addGroupBy(queryString.get(), setQuery, selectedColumnNames.get());
          },
        },
        {
          key: "d",
          label: "distinct",
          action: () => {
              addDistinct(queryString.get(), setQuery, selectedColumnNames.get());
          },
        },
        {
          key: "c",
          label: "count",
          action: () => {
              addCount(queryString.get(), setQuery);
          },
        },
        { 
            key: "p", 
            label: "plot", 
            action: () => {
                if (currentViewMode() === 'plot') {
                    setViewMode('table');
                    return;
                }
                createViewCurrentQuery().then(() => {
                    const selCols = selectedColumns.get();
                    const fill = colorColumn.get();
                    const viewName = currentTableName() + '_view';
                    
                    let spec = getDefaultPlotSpec(selCols, viewName, fill);
                    setPlotSpec(spec, viewName);
                    setViewMode('plot');
                })
            },
        },
        { key: "z", label: "undo", action: () => queryHistory.undo() },
        { key: "Z", label: "redo", action: () => queryHistory.redo() },
        {
            key: "q",
            label: "log query",
            action: () => {
                console.log(queryString.get());
            },
        },
        {
            key: "r",
            label: "reset",
            action: reset,
        },
    ];
}