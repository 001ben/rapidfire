# Interactive Data Explorer

This is a Svelte-based web application that allows you to interactively explore and transform data. It's powered by a custom query language called `XQL`, which is a JavaScript-based query builder that generates DuckDB SQL.

## Features

- **Interactive Data Exploration:** Load datasets from various sources (CSV, XLSX, Parquet) and explore them in a tabular view.
- **`XQL` Query Language:** Use a chainable, JavaScript-based query builder to transform your data. The generated SQL is displayed in a side-by-side view.
- **Data Visualization:** Visualize your data using the integrated plot view.
- **Column Selection:** Easily select columns to include in your analysis.
- **Sorting and Filtering:** Sort and filter your data with a few clicks.
- **Dark Mode:** A dark mode is available for a better viewing experience.

## `XQL` Quickstart

`XQL` is a chainable query builder that allows you to construct SQL queries programmatically. Here's a quick example:

```javascript
// Load the penguins dataset
XQL.from("penguins")
  // Select the species and island columns
  .select("species", "island")
  // Group by island
  .group_by("island")
  // Aggregate by counting the number of rows
  .agg(F.count('*').alias('count'))
  // Order by the count in descending order
  .order_by(F.col('count').desc());
```

This `XQL` query will generate the following SQL:

```sql
SELECT
  island,
  COUNT(*) AS count
FROM
  penguins
GROUP BY
  island
ORDER BY
  count DESC
```

## Developing

Once you've created a project and installed dependencies with `bun install`, start a development server:

```sh
bun run dev

# or start the server and open the app in a new browser tab
bun run dev -- --open
```

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.
