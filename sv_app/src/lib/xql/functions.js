import { Column, Literal, Aggregation } from './expressions.js';

export function col(name) {
    return new Column(name);
}

export function lit(value) {
    return new Literal(value);
}

export const sum = (column) => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('SUM', colExpr);
}

export const avg = (column) => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('AVG', colExpr);
}

export const min = (column) => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('MIN', colExpr);
}

export const max = (column) => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('MAX', colExpr);
}

export const count = (column) => {
    const colExpr = typeof column === 'string' ? col(column) : column;
    return new Aggregation('COUNT', colExpr);
}
