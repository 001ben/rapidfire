export function quoteIfNeeded(identifier: string): string {
    if (identifier === '*') {
        return identifier;
    }
    // A simple regex for valid unquoted SQL identifiers.
    // It must start with a letter or underscore, followed by letters, numbers, or underscores.
    const validIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (validIdentifierRegex.test(identifier)) {
        return identifier;
    }
    return `"${identifier}"`;
}

export class Expression {
  _alias?: string;

  constructor() { }

  eq(value: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, '=', value);
  }

  neq(value: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, '<>', value);
  }

  gt(value: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, '>', value);
  }

  lt(value: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, '<', value);
  }

  gte(value: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, '>=', value);
  }

  lte(value: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, '<=', value);
  }

  and(other: Expression): BinaryExpression {
    return new BinaryExpression(this, 'AND', other);
  }

  or(other: Expression): BinaryExpression {
    return new BinaryExpression(this, 'OR', other);
  }

  plus(value: Expression | string | number): BinaryExpression {
    return new BinaryExpression(this, '+', value);
  }

  is_null(): UnaryPostfixExpression {
    return new UnaryPostfixExpression(this, 'IS NULL');
  }

  is_not_null(): UnaryPostfixExpression {
    return new UnaryPostfixExpression(this, 'IS NOT NULL');
  }

  is_distinct_from(other: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, 'IS DISTINCT FROM', other);
  }

  is_not_distinct_from(other: Expression | string | number | boolean): BinaryExpression {
    return new BinaryExpression(this, 'IS NOT DISTINCT FROM', other);
  }

  between(lower: Expression | string | number, upper: Expression | string | number): TernaryExpression {
    return new TernaryExpression(this, 'BETWEEN', lower, upper);
  }

  not_between(lower: Expression | string | number, upper: Expression | string | number): TernaryExpression {
    return new TernaryExpression(this, 'NOT BETWEEN', lower, upper);
  }

  cast(dataType: string): CastExpression {
    return new CastExpression(this, dataType);
  }

  alias(alias: string): AliasExpression {
    return new AliasExpression(this, alias);
  }

  asc(): SortExpression {
    return new SortExpression(this, 'ASC');
  }

  desc(): SortExpression {
    return new SortExpression(this, 'DESC');
  }

  toSQL(): string {
    throw new Error("toSQL() must be implemented in subclasses");
  }

  toString(): string {
    throw new Error("toString() must be implemented in subclasses");
  }
}

export class Column extends Expression {
  _name: string;
  constructor(name: string) {
    super();
    this._name = name;
  }

  toSQL(): string {
    return quoteIfNeeded(this._name);
  }

  toString(): string {
    return `c("${this._name}")`;
  }
}

export class Literal extends Expression {
  _value: string | number | boolean;
  constructor(value: string | number | boolean) {
    super();
    this._value = value;
  }

  toSQL(): string {
    return typeof this._value === 'string' ? `'${this._value}'` : String(this._value);
  }

  toString(): string {
    return `F.lit(${typeof this._value === 'string' ? `"${this._value}"` : String(this._value)})`;
  }
}

export class BinaryExpression extends Expression {
  _left: Expression;
  _op: string;
  _right: Expression;
  constructor(left: Expression, op: string, right: Expression | string | number | boolean) {
    super();
    this._left = left;
    this._op = op;
    this._right = right instanceof Expression ? right : new Literal(right);
  }

  toSQL(): string {
    return `(${this._left.toSQL()} ${this._op} ${this._right.toSQL()})`
  }

  toString(): string {
    const opMap: { [key: string]: string } = {
      '=': 'eq',
      '>': 'gt',
      '<': 'lt',
      '>=': 'gte',
      '<=': 'lte',
      '<>': 'neq',
      'IS DISTINCT FROM': 'is_distinct_from',
      'IS NOT DISTINCT FROM': 'is_not_distinct_from',
      'AND': 'and',
      'OR': 'or',
      '+': 'plus'
    };
    const methodName = opMap[this._op];
    if (methodName) {
      return `${this._left.toString()}.${methodName}(${this._right.toString()})`;
    }
    throw new Error(`Unsupported operator for toString(): ${this._op}`);
  }
}

export class UnaryPostfixExpression extends Expression {
  _expr: Expression;
  _op: string;

  constructor(expr: Expression, op: string) {
    super();
    this._expr = expr;
    this._op = op;
  }

  toSQL(): string {
    return `(${this._expr.toSQL()} ${this._op})`;
  }

  toString(): string {
    const opMap: { [key: string]: string } = {
      'IS NULL': 'is_null',
      'IS NOT NULL': 'is_not_null',
    };
    const methodName = opMap[this._op];
    if (methodName) {
      return `${this._expr.toString()}.${methodName}()`;
    }
    throw new Error(`Unsupported unary postfix operator for toString(): ${this._op}`);
  }
}

export class TernaryExpression extends Expression {
  _expr: Expression;
  _op: string;
  _lower: Expression;
  _upper: Expression;

  constructor(expr: Expression, op: string, lower: Expression | string | number, upper: Expression | string | number) {
    super();
    this._expr = expr;
    this._op = op;
    this._lower = lower instanceof Expression ? lower : new Literal(lower);
    this._upper = upper instanceof Expression ? upper : new Literal(upper);
  }

  toSQL(): string {
    return `(${this._expr.toSQL()} ${this._op} ${this._lower.toSQL()} AND ${this._upper.toSQL()})`;
  }

  toString(): string {
    const opMap: { [key: string]: string } = {
      'BETWEEN': 'between',
      'NOT BETWEEN': 'not_between',
    };
    const methodName = opMap[this._op];
    if (methodName) {
      return `${this._expr.toString()}.${methodName}(${this._lower.toString()}, ${this._upper.toString()})`;
    }
    throw new Error(`Unsupported ternary operator for toString(): ${this._op}`);
  }
}

export class CastExpression extends Expression {
  _expr: Expression;
  _dataType: string;
  constructor(expr: Expression, dataType: string) {
    super();
    this._expr = expr;
    this._dataType = dataType;
  }

  toSQL(): string {
    // DuckDB uses TRY_CAST for safer conversions, but standard SQL is CAST.
    // We'll use CAST for broader compatibility.
    return `TRY_CAST(${this._expr.toSQL()} AS ${this._dataType.toUpperCase()})`;
  }

  toString(): string {
    return `${this._expr.toString()}.cast("${this._dataType}")`;
  }
}
export class AliasExpression extends Expression {
  _expr: Expression;
  constructor(expr: Expression, alias: string) {
    super();
    this._expr = expr;
    this._alias = alias;
  }

  toSQL(): string {
    return `${this._expr.toSQL()} AS ${quoteIfNeeded(this._alias!)}`;
  }

  toString(): string {
    return `${this._expr.toString()}.alias("${this._alias}")`;
  }
}

export class SortExpression extends Expression {
  _expr: Expression;
  _direction: 'ASC' | 'DESC';
  constructor(expr: Expression, direction: 'ASC' | 'DESC') {
    super();
    this._expr = expr;
    this._direction = direction;
  }

  toSQL(): string {
    return `${this._expr.toSQL()} ${this._direction}`;
  }

  toString(): string {
    return `${this._expr.toString()}.${this._direction.toLowerCase()}()`;
  }
}

export class Aggregation extends Expression {
  _name: string;
  _column: Expression;
  constructor(name: string, column: Expression) {
    super();
    this._name = name;
    this._column = column;
  }

  toSQL(): string {
    return `${this._name}(${this._column.toSQL()})`;
  }

  toString(): string {
    return `F.${this._name.toLowerCase()}(${this._column.toString()})`;
  }
}
