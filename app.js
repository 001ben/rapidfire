// --- 1. APP STATE & CONFIG ---
// Central object to hold shared state, config, and DOM elements.
const app = {
    // State
    baseTable: null,
    currentTable: null,
    selectedColumns: new Set(),
    plotUpdateTimeout: null,
    currentPlotInfo: {},

    // Config
    aceTheme: "ace/theme/tomorrow",
    penguinsURL: 'https://gist.githubusercontent.com/slopp/ce3b90b9168f2f921784de84fa445651/raw/4ecf3041f0ed4913e7c230758733948bc561f434/penguins.csv',
    maxPreviewRows: 100,

    // DOM Elements
    elements: {
        dataView: document.getElementById('data-view'),
        plotView: document.getElementById('plot-view'),
        dataTable: document.getElementById('data-table'),
        errorContainer: document.getElementById('error-container'),
        plotContainer: document.getElementById('plot-container'),
        plotControls: document.getElementById('plot-controls'),
        thresholdSlider: document.getElementById('threshold-slider'),
        thresholdValue: document.getElementById('threshold-value'),
        backToDataButton: document.getElementById('back-to-data-button'),
        copyButton: document.getElementById('copy-button'),
        copyText: document.getElementById('copy-text'),
        copyIcon: document.getElementById('copy-icon'),
        checkIcon: document.getElementById('check-icon'),
        contextMenu: document.getElementById('context-menu'),
    },

    // --- Utility Methods ---
    showError(message) {
        app.elements.errorContainer.textContent = message;
        app.elements.errorContainer.classList.remove('hidden');
    },

    hideError() {
        app.elements.errorContainer.classList.add('hidden');
    },

    // Helper to create a configured Ace editor
    createAceEditor(elementId, options = {}) {
        const editor = ace.edit(elementId);
        editor.setTheme(app.aceTheme);
        editor.session.setMode("ace/mode/javascript");
        editor.setFontSize(14);
        editor.session.setOptions({ useWorker: false });
        if (options.readOnly) {
            editor.setReadOnly(true);
        }
        return editor;
    },
};

// --- 2. DATA VIEW MODULE ---
// Manages the data editor and the results table.
const DataView = {
    editor: null,

    init() {
        this.editor = app.createAceEditor("editor");
        this.editor.session.on('change', this.handleUpdate);
        this.setupCopyButton();
    },

    handleUpdate() {
        const code = DataView.editor.getValue();
        if (!app.baseTable) return;

        try {
            const transform = new Function('table', 'aq', `return ${code};`);
            app.currentTable = transform(app.baseTable, aq);
            app.hideError();
            DataView.renderTable(app.currentTable);
        } catch (err) {
            app.showError(err.message);
            app.currentTable = null; // Invalidate current table on error
        }
    },

    getInferredType(columnName) {
        if (!app.currentTable) return 'any';
        const column = app.currentTable.column(columnName);
        if (!column) return 'any';

        const firstValue = column.find(v => v != null);
        
        if (firstValue == null) return 'null'; // Column is all nulls

        const jsType = typeof firstValue;
        if (jsType === 'string') return 'str';
        if (jsType === 'number') return 'num';
        if (jsType === 'boolean') return 'bool';
        if (jsType === 'object') {
            if (firstValue instanceof Date) return 'date';
            return 'obj'; // Could be array or plain object
        }
        return jsType; // 'bigint', 'symbol', 'undefined'
    },

    renderTable(aqTable) {
        const thead = app.elements.dataTable.querySelector('thead');
        const tbody = app.elements.dataTable.querySelector('tbody');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!aqTable || typeof aqTable.columnNames !== 'function') return;

        const columnNames = aqTable.columnNames();
        const totalRows = aqTable.numRows();
        const rows = aqTable.slice(0, app.maxPreviewRows).objects();

        // Header
        const headerRow = document.createElement('tr');
        columnNames.forEach(name => {
            const th = document.createElement('th');

            // Get the type and create a new display name
            const type = this.getInferredType(name);
            th.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-semibold">${name}</span>
                    <span class="font-normal text-slate-500">${type}</span>
                </div>
            `;
            
            th.className = 'p-3 text-left tracking-wider cursor-pointer transition-colors hover:bg-slate-300';
            
            // We pass the *original* 'name' to the event handlers,
            // not the new formatted textContent.
            th.addEventListener('click', () => DataView.toggleColumnSelection(name));
            th.addEventListener('contextmenu', (e) => {
                DataView.handleHeaderRightClick(e, name); 
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        this.updateHeaderHighlights();

        // Body
        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            columnNames.forEach(name => {
                const td = document.createElement('td');
                const value = row[name];
                td.textContent = value;
                td.className = 'p-3 whitespace-nowrap cursor-pointer';
                td.addEventListener('click', () => DataView.addFilter(name, value));
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // Footer row for long data
        if (totalRows > app.maxPreviewRows) {
            const infoRow = document.createElement('tr');
            infoRow.innerHTML = `<td colspan="${columnNames.length}" class="p-3 text-center text-slate-500 italic bg-slate-50">
                Showing ${app.maxPreviewRows} of ${totalRows} rows...
            </td>`;
            tbody.appendChild(infoRow);
        }
    },

    toggleColumnSelection(columnName) {
        if (app.selectedColumns.has(columnName)) {
            app.selectedColumns.delete(columnName);
        } else {
            app.selectedColumns.add(columnName);
        }
        this.updateHeaderHighlights();
    },

    updateHeaderHighlights() {
        const headers = app.elements.dataTable.querySelectorAll('thead th');
        headers.forEach((th, index) => {
            const columnName = app.currentTable.columnName(index);

            if (app.selectedColumns.has(columnName)) {
                th.classList.add('bg-sky-300', 'text-sky-800');
                th.classList.remove('hover:bg-slate-300');
            } else {
                th.classList.remove('bg-sky-300', 'text-sky-800');
                th.classList.add('hover:bg-slate-300');
            }
        });
    },

    addFilter(columnName, value) {
        const valueString = JSON.stringify(value);
        const newVerb = `\n  .filter(d => d['${columnName}'] === ${valueString})`;
        const currentCode = this.editor.getValue();
        this.editor.setValue(currentCode + newVerb, 1);
    },

    commitColumnSelection() {
        if (app.selectedColumns.size === 0) return;
        const code = this.editor.getValue().trimEnd();
        const columns = Array.from(app.selectedColumns).map(c => `'${c}'`).join(', ');
        const newVerb = `\n  .select(${columns})`;
        this.editor.setValue(code + newVerb, 1);
        app.selectedColumns.clear();
        this.updateHeaderHighlights();
    },

    commitGroupCount() {
        if (app.selectedColumns.size === 0) return;
        const code = this.editor.getValue().trimEnd();
        const columns = Array.from(app.selectedColumns).map(c => `'${c}'`).join(', ');
        const newVerb = `\n  .groupby(${columns})\n  .count()\n  .orderby(aq.desc('count'))`;
        this.editor.setValue(code + newVerb, 1);
        app.selectedColumns.clear();
        this.updateHeaderHighlights();
    },

    handleHeaderRightClick(event, columnName) {
        event.preventDefault(); // Stop the default browser menu
        event.stopPropagation(); // Stop the click from propagating to the document

        const items = [];
        const colType = PlotView.getColumnType(columnName);

        // Context: Other columns are selected (for groupby) and user right-clicked a numeric column
        if (app.selectedColumns.size > 0 && !app.selectedColumns.has(columnName) && colType === 'quantitative') {
            const ops = ['average', 'sum', 'min', 'max', 'count_distinct'];
            ops.forEach(op => {
                items.push({
                    label: `Rollup: ${op}('${columnName}')`,
                    action: () => DataView.commitRollup(columnName, op)
                });
            });
            items.push({ type: 'divider' }); // Add a visual separator
        }

        // Context: General sorting options for any column
        items.push({
            label: `Order by Ascending`,
            action: () => DataView.commitSort(columnName, 'asc')
        });
        items.push({
            label: `Order by Descending`,
            action: () => DataView.commitSort(columnName, 'desc')
        });

        // Show the menu
        AppController.showContextMenu(event, items);
    },

    commitRollup(rollupColumn, operation) {
        if (app.selectedColumns.size === 0) return; // Should be impossible due to menu logic, but good to check

        const code = this.editor.getValue().trimEnd();
        const groupCols = Array.from(app.selectedColumns).map(c => `'${c}'`).join(', ');
        
        // Append a new groupby and rollup
        const newVerb = `\n  .groupby(${groupCols})
  .rollup({ ${operation}_${rollupColumn}: aq.op.${operation}('${rollupColumn}') })`;
    
        this.editor.setValue(code + newVerb, 1);
        app.selectedColumns.clear();
        this.updateHeaderHighlights();
    },

    commitSort(columnName, direction) {
        const code = this.editor.getValue().trimEnd();
        const sortFunc = direction === 'desc' ? 'aq.desc' : '';
        const newVerb = `\n  .orderby(${sortFunc}('${columnName}'))`;
        this.editor.setValue(code + newVerb, 1);
    },

    setupCopyButton() {
        app.elements.copyButton.addEventListener('click', () => {
            const code = this.editor.getValue();
            navigator.clipboard.writeText(code).then(() => {
                app.elements.copyText.textContent = 'Copied!';
                app.elements.copyIcon.classList.add('hidden');
                app.elements.checkIcon.classList.remove('hidden');
                app.elements.copyButton.classList.replace('bg-slate-200', 'bg-green-200');
                app.elements.copyButton.classList.replace('hover:bg-slate-300', 'hover:bg-green-300');

                setTimeout(() => {
                    app.elements.copyText.textContent = 'Copy';
                    app.elements.copyIcon.classList.remove('hidden');
                    app.elements.checkIcon.classList.add('hidden');
                    app.elements.copyButton.classList.replace('bg-green-200', 'bg-slate-200');
                    app.elements.copyButton.classList.replace('hover:bg-green-300', 'hover:bg-slate-300');
                }, 2000);
            });
        });
    }
};

// --- 3. PLOT VIEW MODULE ---
// Manages the plot editor and the plot display.
const PlotView = {
    editor: null,

    init() {
        this.editor = app.createAceEditor("plot-code-editor");
        this.editor.session.on('change', this.debouncedUpdate);
        app.elements.thresholdSlider.addEventListener('input', () => this.renderHistogram());
    },

    // Debounce the update function so it doesn't re-render on every keystroke
    debouncedUpdate() {
        clearTimeout(app.plotUpdateTimeout);
        app.plotUpdateTimeout = setTimeout(PlotView.handleUpdate, 300);
    },

    handleUpdate() {
        const plotCode = PlotView.editor.getValue();
        if (!plotCode || !app.currentTable) return;

        try {
            const data = app.currentTable.objects({ limit: Infinity });
            // The plot code is an expression that needs 'data' and 'Plot' in its scope
            const plot = eval(plotCode); 

            app.elements.plotContainer.innerHTML = ''; // Clear previous plot
            app.elements.plotContainer.appendChild(plot);
            app.hideError(); // Clear previous errors
        } catch (err) {
            app.showError(`Plotting Error: ${err.message}`);
        }
    },

    show() {
        app.elements.dataView.classList.add('hidden');
        app.elements.plotView.classList.remove('hidden');
        // Force Ace editor in plot view to resize
        setTimeout(() => this.editor.resize(), 0);
    },

    hide() {
        app.elements.dataView.classList.remove('hidden');
        app.elements.plotView.classList.add('hidden');
        app.selectedColumns.clear();
        DataView.updateHeaderHighlights();
    },

    getColumnType(columnName) {
        const type = DataView.getInferredType(columnName);
        return (type === 'num' || type === 'date') ? 'quantitative' : 'categorical';
    },

    commitPlot() {
        if (!app.currentTable || app.selectedColumns.size === 0 || app.selectedColumns.size > 2) return;

        app.elements.plotControls.classList.add('hidden');
        app.currentPlotInfo = {};

        const [col1, col2] = Array.from(app.selectedColumns);
        const type1 = this.getColumnType(col1);
        const type2 = col2 ? this.getColumnType(col2) : null;
        let plotCode = '';

        if (app.selectedColumns.size === 1) {
            if (type1 === 'quantitative') {
                // Quantitative (Histogram)
                app.currentPlotInfo = { type: 'histogram', column: col1 };
                app.elements.plotControls.classList.remove('hidden');
                this.renderHistogram();
                this.show();
                return;
            } else {
                // Categorical (Bar Chart)
                plotCode = `Plot.plot({
  marks: [
    Plot.rectY(data, Plot.binX({ y: "count" }, { x: "${col1}" })),
    Plot.ruleY([0])
  ],
  x: { labelAngle: -45, type: "band" },
  marginBottom: 70, marginLeft: 50
})`;
            }
        } else if (app.selectedColumns.size === 2) {
            const [q1, q2] = [type1, type2].map(t => t === 'quantitative');
            if (q1 && q2) {
                // Quant vs Quant (Scatter)
                plotCode = `Plot.plot({
  marks: [ Plot.dot(data, { x: "${col1}", y: "${col2}" }) ],
  grid: true, marginLeft: 50
})`;
            } else if (!q1 && q2) {
                // Cat vs Quant (Bar)
                plotCode = `Plot.plot({
  marks: [ Plot.barY(data, { x: "${col1}", y: "${col2}", sort: {x: "y", reverse: true} }) ],
  x: { labelAngle: -45 }, marginBottom: 70, marginLeft: 50
})`;
            } else if (q1 && !q2) {
                // Quant vs Cat (Bar)
                plotCode = `Plot.plot({
  marks: [ Plot.barY(data, { x: "${col2}", y: "${col1}", sort: {x: "y", reverse: true} }) ],
  x: { labelAngle: -45 }, marginBottom: 70, marginLeft: 50
})`;
            } else {
                // Cat vs Cat (Heatmap)
                plotCode = `Plot.plot({
  marks: [ Plot.dot(data, Plot.group({ fill: "count" }, { x: "${col1}", y: "${col2}" })) ],
  color: { scheme: "viridis" },
  x: { labelAngle: -45 }, marginBottom: 70, marginLeft: 70
})`;
            }
        }

        if (!plotCode) return;
        this.renderStaticPlot(plotCode);
    },

    renderStaticPlot(plotCode) {
        // Set the code in the editor. The editor's 'change' listener will call handleUpdate.
        this.editor.setValue(plotCode, -1);
        this.show();
    },

    renderHistogram() {
        if (app.currentPlotInfo.type !== 'histogram') return;

        const binCount = app.elements.thresholdSlider.value;
        const colName = app.currentPlotInfo.column;
        app.elements.thresholdValue.textContent = binCount;

        const plotCode = `Plot.plot({
  marks: [
    Plot.rectY(data, Plot.binX({ y: "count" }, { x: "${colName}", thresholds: ${binCount} })),
    Plot.ruleY([0])
  ],
  marginLeft: 50
})`;
        
        // This will trigger the 'change' event on the editor, which then calls handleUpdate.
        this.editor.setValue(plotCode, 1);
    }
};

// --- 4. APP INITIALIZATION & GLOBAL EVENTS ---
const AppController = {
    async init() {
        // Initialize modules
        DataView.init();
        PlotView.init();

        // Load initial data
        try {
            app.baseTable = await aq.loadCSV(app.penguinsURL, { autoType: true });
            const initialCode = `table
  // .filter(d => d.bill_length_mm > 40)
  // .groupby('species', 'island')
  // .rollup({ 
  //   avg_bill_length: aq.op.average('bill_length_mm'),
  //   avg_body_mass: aq.op.average('body_mass_g') 
  // })
  // .orderby(aq.desc('avg_body_mass'))`;
            DataView.editor.setValue(initialCode, 1);
            DataView.handleUpdate(); // Initial table render
        } catch (err) {
            app.showError(`Failed to load initial data: ${err.message}`);
        }

        // Setup Global Listeners
        app.elements.backToDataButton.addEventListener('click', PlotView.hide);
        document.addEventListener('keydown', this.handleKeydown);

        // Hide context menu on any click
        document.addEventListener('click', this.handleClickAway);
        
        // Prevent right-click on the menu itself
        app.elements.contextMenu.addEventListener('contextmenu', e => e.preventDefault());

        // Prevent default context menu on the whole page, except for text inputs/editors
        document.addEventListener('contextmenu', (e) => {
            // Allow context menu on inputs, textareas, and the Ace editor
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.ace_editor')) {
                return;
            }
            e.preventDefault(); // Prevent default menu everywhere else
        });
    },

    handleKeydown(event) {
        // Do not interfere if a code editor has focus
        if (DataView.editor.isFocused() || PlotView.editor.isFocused()) return;

        const key = event.key.toLowerCase();
        const isPlotViewVisible = !app.elements.plotView.classList.contains('hidden');

        if (isPlotViewVisible) {
            if (key === 'p' || key === 'escape') {
                event.preventDefault();
                PlotView.hide();
            }
            return;
        }

        // Keydowns for Data View
        switch (key) {
            case 's': event.preventDefault(); DataView.commitColumnSelection(); break;
            case 'g': event.preventDefault(); DataView.commitGroupCount(); break;
            case 'p': event.preventDefault(); PlotView.commitPlot(); break;
            case 'z': event.preventDefault(); DataView.editor.undo(); break;
        }
    },

    handleClickAway(event) {
        // Hide the menu if the click is *not* inside the context menu
        if (!app.elements.contextMenu.contains(event.target)) {
            app.elements.contextMenu.classList.add('hidden');
        }
    },

    showContextMenu(event, items) {
        const menu = app.elements.contextMenu;
        menu.innerHTML = ''; // Clear old items

        if (items.length === 0) return;

        items.forEach(item => {
            if (item.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = "border-t border-slate-200 my-1";
                menu.appendChild(divider);
                return;
            }

            const button = document.createElement('button');
            button.className = "block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100";
            button.textContent = item.label;
            button.onclick = () => {
                item.action();
                menu.classList.add('hidden'); // Hide menu after action
            };
            menu.appendChild(button);
        });

        // Position and show the menu
        // We add window.scrollY in case the page is scrolled
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY + window.scrollY}px`;
        menu.classList.remove('hidden');
    }
};

// --- 5. START THE APP ---
document.addEventListener('DOMContentLoaded', () => AppController.init());