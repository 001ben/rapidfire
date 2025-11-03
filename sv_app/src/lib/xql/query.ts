import { format } from 'sql-formatter';
import { Column, Expression } from './expressions.js';
import { col, lit } from './functions.js';

type SelectOperation = { type: 'select'; columns: Expression[] };
type DistinctOperation = { type: 'distinct'; subset?: Expression[] };
type FilterOperation = { type: 'filter'; expression: Expression };
type GroupByOperation = { type: 'group_by'; columns: Expression[] };
type AggOperation = { type: 'agg'; aggregations: Expression[] };
type OrderByOperation = { type: 'order_by'; columns: Expression[] };
type WithColumnsOperation = { type: 'with_columns'; columns: Expression[] };
type JoinOperation = { type: 'join'; other: XQL; on: Expression; how: string };
type LimitOperation = { type: 'limit'; n: number };
type OffsetOperation = { type: 'offset'; n: number };

type Operation =
    | SelectOperation
    | DistinctOperation
    | FilterOperation
    | GroupByOperation
    | AggOperation
    | OrderByOperation
    | WithColumnsOperation
    | JoinOperation
    | LimitOperation
    | OffsetOperation;

export class XQL {
    private _source: XQL | string | null;
    private _operations: Operation[];

    constructor(source: XQL | string | null = null) {
        this._source = source;
        this._operations = [];
    }

    static from(source: XQL | string): XQL {
        return new XQL(source);
    }

    static select(...columns: (string | number | Expression)[]): XQL {
        const q = new XQL();
        return q.select(...columns);
    }
    
    private _newQuery(op: Operation, subqueryOps: string[]): XQL {
        const hasFinalizingOp = this._operations.some(op => subqueryOps.includes(op.type));
        if (hasFinalizingOp) {
            return new XQL(this)._addOperation(op);
        }
        return this._addOperation(op);
    }

    private _addOperation(op: Operation): XQL {
        const newQuery = this._clone();
        newQuery._operations.push(op);
        return newQuery;
    }

    select(...columns: (string | number | Expression)[]): XQL {
        const columnExpressions = columns.map(c => {
            if (c instanceof Expression) return c;
            if (typeof c === 'string') return col(c);
            return lit(c);
        });
        return this._newQuery({ type: 'select', columns: columnExpressions }, ['with_columns', 'group_by', 'agg']);
    }

    distinct(...subset: (string | Expression)[]): XQL {
        if (subset.length > 0) {
            const columnExpressions = subset.map(c => (typeof c === 'string' ? col(c) : c));
            return this._addOperation({ type: 'distinct', subset: columnExpressions });
        }
        return this._addOperation({ type: 'distinct' });
    }

    filter(expression: Expression): XQL {
        return this._addOperation({ type: 'filter', expression });
    }

    group_by(...columns: (string | Expression)[]): XQL {
        const columnExpressions = columns.map(c => (typeof c === 'string' ? col(c) : c));
        return this._newQuery({ type: 'group_by', columns: columnExpressions }, ['group_by', 'agg', 'order_by']);
    }

    agg(...aggregations: Expression[]): XQL {
        return this._newQuery({ type: 'agg', aggregations }, ['agg', 'order_by', 'distinct']);
    }

    order_by(...columns: (string | Expression)[]): XQL {
        const columnExpressions = columns.map(c => (typeof c === 'string' ? col(c) : c));
        return this._addOperation({ type: 'order_by', columns: columnExpressions });
    }

    with_columns(...columns: (string | Expression)[]): XQL {
        const columnExpressions = columns.map(c => {
            if (c instanceof Expression) return c;
            if (typeof c === 'string') return col(c);
            return lit(c);
        });
        return this._newQuery({ type: 'with_columns', columns: columnExpressions }, ['select', 'with_columns', 'group_by', 'agg']);
    }

    join(other: XQL, on: Expression, how = 'inner'): XQL {
        return this._addOperation({ type: 'join', other, on, how });
    }

    limit(n: number): XQL {
        return this._addOperation({ type: 'limit', n });
    }

    offset(n: number): XQL {
        return this._addOperation({ type: 'offset', n });
    }

    toSQL(isSubquery = false, aliasCounter = { count: 0 }): string {
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
        const setup: string[] = [];
        const main = this._toString(setup);
        return (setup.length ? setup.join('\n') + '\n' : '') + main;
    }

    private _getEffectiveSelect(): SelectOperation | null {
        const selectOps = this._operations.filter(op => op.type === 'select') as SelectOperation[];
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

    private _toString(setup: string[], indent = 0): string {
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
            const firstOp = ops[0];
            if (firstOp?.type === 'select') {
                jsString = `${indentStr}XQL.select(${firstOp.columns.map(c => c.toString()).join(', ')})`;
                ops = ops.slice(1);
            } else {
                throw new Error("A query without a source must begin with 'select'.");
            }
        }

        for (const op of ops) {
            jsString += `\n${nextIndentStr}`;
            switch (op.type) {
                case 'select':
                    jsString += `.select(${op.columns.map(c => c.toString()).join(', ')})`;
                    break;
                case 'distinct':
                    if (op.subset && op.subset.length > 0) {
                        jsString += `.distinct(${op.subset.map(c => c.toString()).join(', ')})`;
                    } else {
                        jsString += `.distinct()`;
                    }
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

    private _clone(): XQL {
        const newQuery = new XQL(this._source);
        newQuery._operations = [...this._operations];
        return newQuery;
    }

    private _getFromClause(aliasCounter: { count: number }): string {
        if (!this._source) return '';

        const getSourceName = (source: XQL | string) => {
            if (typeof source === 'string') {
                return source;
            }
            if (source instanceof XQL && source._operations.length === 0 && typeof source._source === 'string') {
                return source._source;
            }

            const alias = `t${aliasCounter.count++}`;
            const subQuerySql = source.toSQL(true, aliasCounter).split('\n').map((line: string) => '  ' + line).join('\n');
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

    private _getSelectClause(): string {
        const distinctOp = this._operations.find(op => op.type === 'distinct') as DistinctOperation;
        let distinctClause = '';
        if (distinctOp) {
            if (distinctOp.subset && distinctOp.subset.length > 0) {
                const subsetCols = distinctOp.subset.map(c => c.toSQL()).join(', ');
                distinctClause = `DISTINCT ON (${subsetCols}) `;
            } else {
                distinctClause = 'DISTINCT ';
            }
        }

        const aggOp = this._operations.find(op => op.type === 'agg');
        if (aggOp) {
            const group_byOp = this._operations.find(op => op.type === 'group_by');
            const group_byCols = group_byOp ? group_byOp.columns.map(c => c.toSQL()) : [];
            const aggCols = aggOp.aggregations.map(a => a.toSQL());
            return `${distinctClause}${ [...group_byCols, ...aggCols].join(', ')}`;
        }

        const withColsOp = this._operations.find(op => op.type === 'with_columns');
        if (withColsOp) {
            const replacements = withColsOp.columns
                .filter(c => c._alias)
                .map(c => c.toSQL());

            const replaceClause = replacements.length > 0 ? `REPLACE (${replacements.join(', ')})` : '';
            return `${distinctClause}* ${replaceClause}`;
        }
        const selectOp = this._getEffectiveSelect();
        if (selectOp) {
            return `${distinctClause}${selectOp.columns.map(c => c.toSQL()).join(', ')}`;
        }
        return `${distinctClause}*`;
    }

    private _getWhereClause(): string | null {
        const filterOps = this._operations.filter(op => op.type === 'filter');
        if (filterOps.length === 0) return null;
        const conditions = filterOps.map(op => op.expression.toSQL()).join(' AND ');
        return `WHERE ${conditions}`;
    }

    private _getgroup_byClause(): string | null {
        const group_byOp = this._operations.find(op => op.type === 'group_by');
        if (!group_byOp) return null;
        return `GROUP BY ${group_byOp.columns.map(c => c.toSQL()).join(', ')}`;
    }

    private _getorder_byClause(): string | null {
        const order_byOp = this._operations.findLast(op => op.type === 'order_by');
        if (!order_byOp) return null;
        return `ORDER BY ${order_byOp.columns.map(c => c.toSQL()).join(', ')}`;
    }

    private _getLimitClause(): string | null {
        const limitOp = this._operations.find(op => op.type === 'limit');
        if (!limitOp) return null;
        return `LIMIT ${limitOp.n}`;
    }

    private _getOffsetClause(): string | null {
        const offsetOp = this._operations.find(op => op.type === 'offset');
        if (!offsetOp) return null;
        return `OFFSET ${offsetOp.n}`;
    }
}
