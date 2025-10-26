import type { StateHistory } from "runed";
import { addGroupBy, addSelect } from "./actions";

type ShortcutDependencies = {
    queryString: {
        get: () => string;
    };
    selectedColumns: {
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
    setPlotSpec: (spec: string) => void;
}

export function createShortcuts({ queryString, selectedColumns, colorColumn, currentTableName, createViewCurrentQuery, queryHistory, reset, setQuery, currentViewMode, setViewMode, setPlotSpec }: ShortcutDependencies) {
    return [
        {
            key: "s",
            label: "select",
            action: () => {
                addSelect(queryString.get(), setQuery, selectedColumns.get());
            },
        },
        {
            key: "g",
            label: "group/count",
            action: () => {
                addGroupBy(queryString.get(), setQuery, selectedColumns.get());
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
                const cols = selectedColumns.get();
                const fill = colorColumn.get();
                let spec = '';
                if (cols.length === 1) {
                    // Histogram for a single column
                    spec = `
                    vg.vconcat(
                        vg.plot(
        vg.barX(vg.from("${currentTableName()}_view"), { 
            x: vg.count(), 
            y: ${cols[0]}, 
            fill: ${fill ? `"${fill}"` : cols[0]},
            sort: {y: "-x", limit: 25},
            tip: true,
        }),
        vg.name("${currentTableName()}_view_plot"),
        vg.width(width),
        vg.height(height),
        vg.marginLeft(60),
        vg.yLabelAnchor("top")
    ),
    vg.colorLegend({for: "${currentTableName()}_view_plot"})
)`;
                } else if (cols.length === 2) {
                    // Scatter plot for two columns
                    let init_spec = `vg.plot(
    vg.dot(vg.from("${currentTableName()}_view"), { 
        x: ${cols[0]}, 
        y: ${cols[1]},
        r: 6,
        tip: true,
        ${fill ? `fill: "${fill}",` : ''}
    }),
    vg.name("${currentTableName()}_view_plot"),
    vg.width(width),
    vg.height(height),
    vg.marginLeft(60),
    vg.yLabelAnchor("top")
)`
                    spec = fill ? `vg.vconcat(${init_spec},
                    vg.colorLegend({for: "${currentTableName()}_view_plot"}))` : init_spec;
                } else {
                    console.warn("Plotting is only supported for 1 or 2 selected columns.");
                    return;
                }
                setPlotSpec(spec);
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