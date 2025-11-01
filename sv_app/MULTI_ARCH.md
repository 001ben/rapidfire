# Refactoring for Multi-View Architecture

This document outlines the architectural changes required to evolve the application from a single data editor into a multi-view workspace supporting multiple tables and plots.

## 1. Current Architecture (Single-View)

Our current application is structured around a single, global state managed entirely within the main +page.svelte component.

### Key Characteristics:

**Centralized State:** +page.svelte holds all application state as local $state variables (queryString, tableData, isLoadingQuery, tableHeaders, etc.).  
**Controller Page:** The page component acts as a "controller," orchestrating the flow of data between its child components (EditorPanel, DataTable).  
**Implicit Singularity:** All components and logic (like shortcuts) implicitly operate on this single, global state. There is no concept of another table or another query existing simultaneously.  
**Direct Coupling:** The data-fetching logic ($effect) is tightly coupled to the page's local state.  

**Diagram:**  
```plaintext
+----------------------------------------------------------------+
| +page.svelte                                                   |
|                                                                |
|   [State: queryString, tableData, isLoading, etc.]             |
|   [Effect: watches queryString -> fetches data -> sets tableData] |
|                                                                |
|   +----------------------------------------------------------+ |
|   | EditorPanel (bind:queryString)                           | |
|   +----------------------------------------------------------+ |
|                                                                |
|   +----------------------------------------------------------+ |
|   | DataTable (tableData={tableData})                        | |
|   +----------------------------------------------------------+ |
|                                                                |
|   +----------------------------------------------------------+ |
|   | ShortcutRibbon (actions operate on global state)         | |
|   +----------------------------------------------------------+ |
|                                                                |
+----------------------------------------------------------------+
```

This architecture is simple and effective for a single-purpose tool but doesn't scale to multiple, independent, or related views.

## 2. Future Architecture (Multi-View)

The goal is to manage a collection of "views" (tables, plots), where each view has its own isolated state. The user can switch between these views using tabs.

### Key Characteristics:

**Encapsulated View State:** We will introduce a View class or factory function. Each View instance will encapsulate all the state related to a single tab (its query, its data, its loading status, its UI state, etc.).  
**View Management:** +page.svelte will transition from managing individual state variables to managing a list of View objects (e.g., views = $state([])). It will also track the activeViewId.  
**Reactive Active View:** A $derived state will provide the currently active View object to all child components.  
**Decoupled Components:** Components like EditorPanel and DataTable will no longer be tied to a global state. Instead, they will receive the activeView object as a prop and operate on its state.  
**Contextual Shortcuts:** The shortcut actions will be updated to operate on the state of the activeView.  

### Diagram:
```plaintext 
+----------------------------------------------------------------------+
| +page.svelte                                                         |
|                                                                      |
|   [State: views = [View1, View2, ...], activeViewId]                  |
|   [Derived: activeView = views.find(v => v.id === activeViewId)]     |
|   [Effect: watches activeView.query -> updates activeView.tableData] |
|                                                                      |
|   +----------------------------------------------------------------+ |
|   | TabStrip (renders `views`, sets `activeViewId` on click)       | |
|   +----------------------------------------------------------------+ |
|                                                                      |
|   +----------------------------------------------------------------+ |
|   | Workspace (receives `activeView` as a prop)                    | |
|   |                                                                | |
|   |   +----------------------------------------------------------+ | |
|   |   | EditorPanel (bind:queryString={activeView.queryString})  | | |
|   |   +----------------------------------------------------------+ | |
|   |                                                                | |
|   |   +----------------------------------------------------------+ | |
|   |   | DataTable (tableData={activeView.tableData})             | | |
|   |   +----------------------------------------------------------+ | |
|   |                                                                | |
|   +----------------------------------------------------------------+ |
|                                                                      |
|   +----------------------------------------------------------------+ |
|   | ShortcutRibbon (actions operate on `activeView` state)         | |
|   +----------------------------------------------------------------+ |
|                                                                      |
+----------------------------------------------------------------------+
```

### 3. Step-by-Step Refactoring Plan  
Here is the sequence of changes needed to transition from the current to the future architecture.

**Step 1:** Create the View State Container  
1. Create a new file, e.g., src/lib/view.ts.
2. Define a class View or a factory function createView().
3. This container will hold all the state that is currently in +page.svelte:  

   - id (a unique identifier)
   - title (e.g., "penguins")
   - type ('table' or 'plot')
   - queryString = $state(...)
   - queryHistory (an instance of StateHistory for this view's queryString)
   - tableData = $state(...)
   - tableHeaders = $state(...)
   - selectedColumns = $derived(...)
   - isLoading = $state(false)  
   - ...and all other related state variables (offset, limit, hasMoreData, etc.).  
   
**Step 2:** Refactor +page.svelte to be a View Manager  

1. Remove all the individual state variables that were moved into the View container.
2. Create a new state variable: const views = $state([new View(...)]) to hold the list of all open views. Initialize it with one default view.
3. Create a state variable for the active tab: let activeViewId = $state(views[0].id).
4. Create a derived variable for the active view object: const activeView = $derived(views.find(v => v.id === activeViewId)).

**Step 3:** Adapt UI Components and Data Flow  

1. Create a new TabStrip.svelte component that takes views and activeViewId as props. It will render the tabs and update activeViewId when a tab is clicked.
2. Create a new Workspace.svelte component that takes the activeView object as its main prop.
Inside Workspace.svelte, pass the state from the activeView object down to the EditorPanel and DataTable components.

   - Example: <EditorPanel bind:queryString={activeView.queryString} ... />
   - Example: <DataTable bind:tableHeaders={activeView.tableHeaders} ... />

**Step 4:** Update Side Effects and Shortcuts  

   - The main data-fetching $effect in +page.svelte will now watch activeView and its properties. When activeView.sqlQuery changes, it will fetch data and update activeView.tableData.
   - The createShortcuts factory function in src/lib/shortcuts.ts will need to be updated. Instead of taking individual state getters, it should now accept the activeView object (or a getter for it) and derive the state it needs from there.
   - The action closures will now modify the state of the activeView, e.g., activeView.queryString = ....

