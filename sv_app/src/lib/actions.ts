export function addGroupBy(currentQuery: string, setQuery: (q: string) => void, columns: string[]) {
    const colnames = columns.map(c => c.replaceAll('"', ''));
    if (colnames.length === 0) {
        return;
    }

    let countCol = 'count';
    while (colnames.includes(countCol)) {
        countCol += '_' + countCol;
    }

    const newQuery = `${currentQuery}\n  .group_by(${colnames.map(c => `"${c}"`).join(', ')})\n  .agg(F.count('*').alias('${countCol}'))\n  .order_by(F.col('${countCol}').desc())`;
    setQuery(newQuery);
}

export function addSelect(currentQuery: string, setQuery: (q: string) => void, columns: string[]) {
    let colnames = columns.map(c => c.replaceAll('"', ''));
    if (colnames.length === 0) {
        colnames = ['*'];
    }
    const newQuery = `${currentQuery}\n  .select(${colnames.map(c => `"${c}"`).join(', ')})`;
    setQuery(newQuery);
}

export function addCast(currentQuery: string, setQuery: (q: string) => void, column: string, dataType: string) {
    // This expression will overwrite the existing column with the newly casted one.
    const castExpr = `F.col("${column}").cast("${dataType.toUpperCase()}").alias("${column}")`;

    const trimmedQuery = currentQuery.trim();
    const lines = trimmedQuery.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    if (lastLine.startsWith('.with_columns')) {
        // Find the last closing parenthesis on the last line
        const lastParenIndex = lastLine.lastIndexOf(')');
        if (lastParenIndex !== -1) {
            // Insert the new cast expression before the last parenthesis
            const newLastLine = `${lastLine.slice(0, lastParenIndex)}, ${castExpr})`;
            // Replace the old last line with the new one
            lines[lines.length - 1] = newLastLine;
            const newQuery = lines.join('\n');
            setQuery(newQuery);
            return;
        }
    } else {
        // No .with_columns() at the end, so append a new one.
        const newQuery = `${currentQuery}\n  .with_columns(${castExpr})`;
        setQuery(newQuery);
    }
}

export function addSort(currentQuery: string, setQuery: (q: string) => void, column: string, direction: 'asc' | 'desc') {
    const sortExpr = `F.col("${column}").${direction}()`;

    const trimmedQuery = currentQuery.trim();
    const lines = trimmedQuery.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    if (lastLine.startsWith('.order_by')) {
        const lastParenIndex = lastLine.lastIndexOf(')');
        if (lastParenIndex !== -1) {
            const newLastLine = `${lastLine.slice(0, lastParenIndex)}, ${sortExpr})`;
            lines[lines.length - 1] = newLastLine;
            setQuery(lines.join('\n'));
            return;
        }
    }
    
    // No .order_by() at the end, so append a new one.
    setQuery(`${currentQuery}\n  .order_by(${sortExpr})`);
}
