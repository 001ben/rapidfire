export function quoteIfNeeded(identifier) {
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
  constructor() { }

  eq(value) {
    return new BinaryExpression(this, '=', value);
  }

  gt(value) {
    return new BinaryExpression(this, '>', value);
  }

  lt(value) {
    return new BinaryExpression(this, '<', value);
  }

  gte(value) {
    return new BinaryExpression(this, '>=', value);
  }

  lte(value) {
    return new BinaryExpression(this, '<=', value);
  }

  and(other) {
    return new BinaryExpression(this, 'AND', other);
  }

  or(other) {
    return new BinaryExpression(this, 'OR', other);
  }

  plus(value) {
    return new BinaryExpression(this, '+', value);
  }

  cast(dataType) {
    return new CastExpression(this, dataType);
  }

  alias(alias) {
    return new AliasExpression(this, alias);
  }

  asc() {
    return new SortExpression(this, 'ASC');
  }

  desc() {
    return new SortExpression(this, 'DESC');
  }

  toSQL() {
    throw new Error("toSQL() must be implemented in subclasses");
  }

  toString() {
    throw new Error("toString() must be implemented in subclasses");
  }
}

export class Column extends Expression {
  constructor(name) {
    super();
    this._name = name;
  }

  toSQL() {
    return quoteIfNeeded(this._name);
  }

  toString() {
    return `F.col("${this._name}")`;
  }
}

export class Literal extends Expression {
  constructor(value) {
    super();
    this._value = value;
  }

  toSQL() {
    return typeof this._value === 'string' ? `'${this._value}'` : String(this._value);
  }

  toString() {
    return `F.lit(${typeof this._value === 'string' ? `"${this._value}"` : String(this._value)})`;
  }
}

export class BinaryExpression extends Expression {
  constructor(left, op, right) {
    super();
    this._left = left;
    this._op = op;
    this._right = right instanceof Expression ? right : new Literal(right);
  }

  toSQL() {
    return `(${this._left.toSQL()} ${this._op} ${this._right.toSQL()})`
  }

  toString() {
    const opMap = {
      '=': 'eq',
      '>': 'gt',
      '<': 'lt',
      '>=': 'gte',
      '<=': 'lte',
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

export class CastExpression extends Expression {
  constructor(expr, dataType) {
    super();
    this._expr = expr;
    this._dataType = dataType;
  }

  toSQL() {
    // DuckDB uses TRY_CAST for safer conversions, but standard SQL is CAST.
    // We'll use CAST for broader compatibility.
    return `TRY_CAST(${this._expr.toSQL()} AS ${this._dataType.toUpperCase()})`;
  }

  toString() {
    return `${this._expr.toString()}.cast("${this._dataType}")`;
  }
}
export class AliasExpression extends Expression {
  constructor(expr, alias) {
    super();
    this._expr = expr;
    this._alias = alias;
  }

  toSQL() {
    return `${this._expr.toSQL()} AS ${quoteIfNeeded(this._alias)}`;
  }

  toString() {
    return `${this._expr.toString()}.alias("${this._alias}")`;
  }
}

class SortExpression extends Expression {
  constructor(expr, direction) {
    super();
    this._expr = expr;
    this._direction = direction;
  }

  toSQL() {
    return `${this._expr.toSQL()} ${this._direction}`;
  }

  toString() {
    return `${this._expr.toString()}.${this._direction.toLowerCase()}()`;
  }
}

export class Aggregation extends Expression {
  constructor(name, column) {
    super();
    this._name = name;
    this._column = column;
  }

  toSQL() {
    return `${this._name}(${this._column.toSQL()})`;
  }

  toString() {
    return `F.${this._name.toLowerCase()}(${this._column.toString()})`;
  }
}
