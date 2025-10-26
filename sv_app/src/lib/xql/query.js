import { format } from 'sql-formatter';
import { Column, Expression, quoteIfNeeded } from './expressions.js';
import { col, lit } from './functions.js';

export class XQL {
    constructor(source = null) {
        this._source = source;
        this._operations = [];
    }

    static from(source) {
        return new XQL(source);
    }

    static select(...columns) {
        const q = new XQL();
        return q.select(...columns);
    }

    select(...columns) {
        const hasFinalizingOp = this._operations.some(op =>
            ['with_columns', 'group_by', 'agg'].includes(op.type)
        );

        if (hasFinalizingOp) {
            const newQuery = new XQL(this);
            return newQuery.select(...columns);
        } else {
            const newQuery = this._clone();
            const columnExpressions = columns.map(c => {
                if (c instanceof Expression) return c;
                if (typeof c === 'string') return col(c);
                return lit(c);
            });
            newQuery._operations.push({ type: 'select', columns: columnExpressions });
            return newQuery;
        }
    }

    filter(expression) {
        const newQuery = this._clone();
        newQuery._operations.push({ type: 'filter', expression });
        return newQuery;
    }

    group_by(...columns) {
        const hasExistingAggregation = this._operations.some(op => op.type === 'group_by' || op.type === 'agg');

        if (hasExistingAggregation) {
            const newQuery = new XQL(this);
            return newQuery.group_by(...columns);
        } else {
            const newQuery = this._clone();
            const columnExpressions = columns.map(c => typeof c === 'string' ? col(c) : c);
            newQuery._operations.push({ type: 'group_by', columns: columnExpressions });
            return newQuery;
        }
    }

    agg(...aggregations) {
        const newQuery = this._clone();
        newQuery._operations.push({ type: 'agg', aggregations });
        return newQuery;
    }

    order_by(...columns) {
        const newQuery = this._clone();
        const columnExpressions = columns.map(c => typeof c === 'string' ? col(c) : c);
        newQuery._operations.push({ type: 'order_by', columns: columnExpressions });
        return newQuery;
    }

    with_columns(...columns) {
        const hasFinalizingOp = this._operations.some(op =>
            ['select', 'with_columns', 'group_by', 'agg'].includes(op.type)
        );

        if (hasFinalizingOp) {
            const newQuery = new XQL(this);
            return newQuery.with_columns(...columns);
        } else {
            const newQuery = this._clone();
            const columnExpressions = columns.map(c => {
                if (c instanceof Expression) return c;
                if (typeof c === 'string') return col(c);
                return lit(c);
            });
            newQuery._operations.push({ type: 'with_columns', columns: columnExpressions });
            return newQuery;
        }
    }

    join(other, on, how = 'inner') {
        const newQuery = this._clone();
        newQuery._operations.push({ type: 'join', other, on, how });
        return newQuery;
    }

    limit(n) {
        const newQuery = this._clone();
        newQuery._operations.push({ type: 'limit', n });
        return newQuery;
    }

    offset(n) {
        const newQuery = this._clone();
        newQuery._operations.push({ type: 'offset', n });
        return newQuery;
    }

    toSQL(isSubquery = false, aliasCounter = { count: 0 }) {
        const fromClause = this._getFromClause(aliasCounter);
        const whereClause = this._getWhereClause();
        const group_byClause = this._getgroup_byClause();
        const order_byClause = this._getorder_byClause();
        const limitClause = this._getLimitClause();
        const offsetClause = this._getOffsetClause();
        const selectClause = this._getSelectClause();

        let sql = `SELECT ${selectClause}`;
        if (fromClause) sql += ` ${fromClause}`;
        if (whereClause) sql += ` ${whereClause}`;
        if (group_byClause) sql += ` ${group_byClause}`;

        // Only add these clauses if it's NOT a subquery
        if (order_byClause && !isSubquery) sql += ` ${order_byClause}`;
        if (limitClause && !isSubquery) sql += ` ${limitClause}`;
        if (offsetClause && !isSubquery) sql += ` ${offsetClause}`;

        return format(sql, { language: 'duckdb' });
    }

    toString() {
        const setup = [];
        const main = this._toString(setup);
        return (setup.length ? setup.join('\n') + '\n' : '') + main;
    }

    _getEffectiveSelect() {
        const selectOps = this._operations.filter(op => op.type === 'select');
        if (selectOps.length === 0) return null;

        let lastNonWildcardSelect = null;
        for (let i = selectOps.length - 1; i >= 0; i--) {
            const op = selectOps[i];
            const isWildcard = op.columns.length === 1 &&
                op.columns[0] instanceof Column &&
                op.columns[0]._name === '*';
            if (!isWildcard) {
                lastNonWildcardSelect = op;
                break;
            }
        }

        if (lastNonWildcardSelect) {
            return lastNonWildcardSelect;
        }

        // All selects are `*`, so return the first one.
        return selectOps[0];
    }

    _toString(setup, indent = 0) {
        const indentStr = '  '.repeat(indent);
        const nextIndentStr = '  '.repeat(indent + 1);

        let jsString;
        let ops = this._operations;

        const effectiveSelect = this._getEffectiveSelect();
        if (effectiveSelect) {
            let foundEffective = false;
            ops = ops.filter(op => {
                if (op.type !== 'select') return true;
                if (op === effectiveSelect && !foundEffective) {
                    foundEffective = true;
                    return true;
                }
                return false;
            });
        }

        if (this._source) {
            if (typeof this._source === 'string') {
                jsString = `${indentStr}XQL.from("${this._source}")`;
            } else { // It's a XQL object
                const varName = `t${setup.length}`;
                setup.push(`const ${varName} = ${this._source._toString(setup)};`);
                jsString = `${indentStr}XQL.from(${varName})`;
            }
        } else {
            const selectOp = ops[0];
            jsString = `${indentStr}XQL.select(${selectOp.columns.map(c => c.toString()).join(', ')})`;
            ops = ops.slice(1);
        }

        for (const op of ops) {
            jsString += `\n${nextIndentStr}`;
            switch (op.type) {
                case 'select':
                    jsString += `.select(${op.columns.map(c => c.toString()).join(', ')})`;
                    break;
                case 'with_columns':
                    jsString += `.with_columns(${op.columns.map(c => c.toString()).join(', ')})`;
                    break;
                case 'filter':
                    jsString += `.filter(${op.expression.toString()})`;
                    break;
                case 'group_by':
                    jsString += `.group_by(${op.columns.map(c => c.toString()).join(', ')})`;
                    break;
                case 'agg':
                    jsString += `.agg(${op.aggregations.map(a => a.toString()).join(', ')})`;
                    break;
                case 'order_by':
                    jsString += `.order_by(${op.columns.map(c => c.toString()).join(', ')})`;
                    break;
                case 'join':
                    const varName = `t${setup.length}`;
                    setup.push(`const ${varName} = ${op.other._toString(setup)};`);
                    jsString += `.join(${varName}, ${op.on.toString()}, "${op.how}")`;
                    break;
                case 'limit':
                    jsString += `.limit(${op.n})`;
                    break;
                case 'offset':
                    jsString += `.offset(${op.n})`;
                    break;
            }
        }
        return jsString;
    }

    _clone() {
        const newQuery = new XQL(this._source);
        newQuery._operations = [...this._operations];
        return newQuery;
    }

    _getFromClause(aliasCounter) {
        if (!this._source) return '';

        const getSourceName = (source) => {
            if (typeof source === 'string') {
                return source;
            }
            if (source instanceof XQL && source._operations.length === 0 && typeof source._source === 'string') {
                return source._source;
            }

            const alias = `t${aliasCounter.count++}`;
            const subQuerySql = source.toSQL(true, aliasCounter).split('\n').map(line => '  ' + line).join('\n');
            return `(\n${subQuerySql}\n) AS ${alias}`;
        };

        let fromClause = `FROM ${getSourceName(this._source)}`;

        const joinOps = this._operations.filter(op => op.type === 'join');
        for (const op of joinOps) {
            const how = op.how.toUpperCase();
            fromClause += ` ${how} JOIN ${getSourceName(op.other)} ON ${op.on.toSQL()}`;
        }

        return fromClause;
    }

    _getSelectClause() {
        const aggOp = this._operations.find(op => op.type === 'agg');
        if (aggOp) {
            const group_byOp = this._operations.find(op => op.type === 'group_by');
            const group_byCols = group_byOp ? group_byOp.columns.map(c => c.toSQL()) : [];
            const aggCols = aggOp.aggregations.map(a => a.toSQL());
            return [...group_byCols, ...aggCols].join(', ');
        }

        const withColsOp = this._operations.find(op => op.type === 'with_columns');
        if (withColsOp) {
            // For `with_columns`, we assume any aliased expression is either a new column
            // or is intended to overwrite an existing one.
            // We can partition them into columns to add and columns to replace.
            // However, without knowing the source schema, it's hard to know if an alias
            // is a new column or an overwrite.
            // DuckDB's `REPLACE` is perfect for overwrites, and `SELECT *, ...` for new columns.
            // A simple and effective strategy is to treat all aliased columns in `with_columns`
            // as replacements. This aligns with the Polars API's intent.

            const replacements = withColsOp.columns
                .filter(c => c._alias)
                .map(c => c.toSQL()); // c.toSQL() will be like `(a + 1) AS "a"`

            const replaceClause = replacements.length > 0 ? `REPLACE (${replacements.join(', ')})` : '';

            return `* ${replaceClause}`;
        }
        const selectOp = this._getEffectiveSelect();
        if (selectOp) {
            return selectOp.columns.map(c => c.toSQL()).join(', ');
        }
        return '*';
    }

    _getWhereClause() {
        const filterOps = this._operations.filter(op => op.type === 'filter');
        if (filterOps.length === 0) return null;
        const conditions = filterOps.map(op => op.expression.toSQL()).join(' AND ');
        return `WHERE ${conditions}`;
    }

    _getgroup_byClause() {
        const group_byOp = this._operations.find(op => op.type === 'group_by');
        if (!group_byOp) return null;
        return `GROUP BY ${group_byOp.columns.map(c => c.toSQL()).join(', ')}`;
    }

    _getorder_byClause() {
        const order_byOp = this._operations.find(op => op.type === 'order_by');
        if (!order_byOp) return null;
        return `ORDER BY ${order_byOp.columns.map(c => c.toSQL()).join(', ')}`;
    }

    _getLimitClause() {
        const limitOp = this._operations.find(op => op.type === 'limit');
        if (!limitOp) return null;
        return `LIMIT ${limitOp.n}`;
    }

    _getOffsetClause() {
        const offsetOp = this._operations.find(op => op.type === 'offset');
        if (!offsetOp) return null;
        return `OFFSET ${offsetOp.n}`;
    }
}
