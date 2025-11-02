import { Column, Literal, Aggregation, Expression } from './expressions.js';

export function col(name: string): Column {
    return new Column(name);
}

export function lit(value: string | number | boolean): Literal {
    return new Literal(value);
}

export const sum = (column: string | Expression): Aggregation => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('SUM', colExpr);
}

export const avg = (column: string | Expression): Aggregation => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('AVG', colExpr);
}

export const min = (column: string | Expression): Aggregation => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('MIN', colExpr);
}

export const max = (column: string | Expression): Aggregation => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('MAX', colExpr);
}

export const count = (column: string | Expression): Aggregation => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('COUNT', colExpr);
}
