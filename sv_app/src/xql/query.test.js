import { XQL, F } from './index.js';

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (e) {
        console.error(`❌ ${name}`);
        console.error(e);
        process.exit(1);
    }
}

function assertEquals(a, b) {
    const aClean = a.trim().replace(/\s+/g, '');
    const bClean = b.trim().replace(/\s+/g, '');
    if (aClean !== bClean) {
        console.error("EXPECTED:", b);
        console.error("ACTUAL:", a);
        throw new Error(`Assertion failed`);
    }
}

test("basic select", () => {
    const q = XQL.from("my_table").select("a", "b");
    assertEquals(q.toSQL(), `
        SELECT
          a,
          b
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(F.col("a"), F.col("b"))
    `);
});

test("select with alias", () => {
    const q = XQL.from("my_table").select(F.col("a").alias("my_a"));
    assertEquals(q.toSQL(), `
        SELECT
          a AS my_a
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(F.col("a").alias("my_a"))
    `);
});

test("sequential select", () => {
    const q = XQL.from("penguins")
        .select("species", "island")
        .select("island");

    assertEquals(q.toSQL(), `
        SELECT
          island
        FROM
          penguins
    `);
    assertEquals(q.toString(), `
        XQL.from("penguins")
          .select(F.col("island"))
    `);
});

test("sequential select with wildcard", () => {
    const q = XQL.from("penguins")
        .select(F.col("*"))
        .select("species", "island");

    assertEquals(q.toSQL(), `
        SELECT
          species,
          island
        FROM
          penguins
    `);
    assertEquals(q.toString(), `
        XQL.from("penguins")
          .select(F.col("species"), F.col("island"))
    `);
});

test("sequential select with wildcard at the end", () => {
    const q = XQL.from("penguins")
        .select("species", "island")
        .select(F.col("*"));

    assertEquals(q.toSQL(), `
        SELECT
          species,
          island
        FROM
          penguins
    `);
    assertEquals(q.toString(), `
        XQL.from("penguins")
          .select(F.col("species"), F.col("island"))
    `);
});

test("from-less select", () => {
    const q = XQL.select(1);
    assertEquals(q.toSQL(), `
        SELECT
          1
    `);
    assertEquals(q.toString(), `XQL.select(F.lit(1))`);
});

test("filter with gt", () => {
    const q = XQL.from("my_table").filter(F.col("a").gt(10));
    assertEquals(q.toSQL(), `
        SELECT
          *
        FROM
          my_table
        WHERE
          (a > 10)
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .filter(F.col("a").gt(F.lit(10)))
    `);
});

test("filter with and", () => {
    const q = XQL.from("my_table").filter(F.col("a").gt(10).and(F.col("b").lt(5)));
    assertEquals(q.toSQL(), `
        SELECT
          *
        FROM
          my_table
        WHERE
          (
            (a > 10)
            AND (b < 5)
          )
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .filter(F.col("a").gt(F.lit(10)).and(F.col("b").lt(F.lit(5))))
    `);
});

test("group_by and agg", () => {
    const q = XQL.from("my_table")
        .group_by("a")
        .agg(F.sum("b").alias("total_b"));
    assertEquals(q.toSQL(), `
        SELECT
          a,
          SUM(b) AS total_b
        FROM
          my_table
        GROUP BY
          a
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .group_by(F.col("a"))
          .agg(F.sum(F.col("b")).alias("total_b"))
    `);
});

test("order_by", () => {
    const q = XQL.from("my_table").order_by(F.col("a").desc());
    assertEquals(q.toSQL(), `
        SELECT
          *
        FROM
          my_table
        ORDER BY
          a DESC
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .order_by(F.col("a").desc())
    `);
});

test("join", () => {
    const t1 = XQL.from("table1");
    const t2 = XQL.from("table2");
    const q = t1.join(t2, F.col("a").eq(F.col("b")));
    assertEquals(q.toSQL(), `
        SELECT
          *
        FROM
          table1
          INNER JOIN table2 ON (a = b)
    `);
    assertEquals(q.toString(), `const t0 = XQL.from("table2");
XQL.from("table1")\n  .join(t0, F.col("a").eq(F.col("b")), "inner")`);
});

test("limit and offset", () => {
    const q = XQL.from("my_table").limit(10).offset(20);
    assertEquals(q.toSQL(), `
        SELECT
          *
        FROM
          my_table
        LIMIT
          10
        OFFSET
          20
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .limit(10)
          .offset(20)
    `);
});

test("chained group_by", () => {
    const q = XQL.from("my_table")
        .group_by("country", "city")
        .agg(F.count("*").alias("city_count"))
        .group_by("country")
        .agg(F.count("*").alias("distinct_cities"));

    assertEquals(q.toSQL(), `
        SELECT
          country,
          COUNT(*) AS distinct_cities
        FROM
          (
            SELECT
              country,
              city,
              COUNT(*) AS city_count
            FROM
              my_table
            GROUP BY
              country,
              city
          ) AS t0
        GROUP BY
          country
    `);

    assertEquals(q.toString(), `
        const t0 = XQL.from("my_table")
          .group_by(F.col("country"), F.col("city"))
          .agg(F.count(F.col("*")).alias("city_count"));
        XQL.from(t0)
          .group_by(F.col("country"))
          .agg(F.count(F.col("*")).alias("distinct_cities"))
    `);
});

test("complex chained operations", () => {
    const q = XQL.from("penguins")
        .select("species", "island")
        .group_by("island")
        .agg(F.count('*').alias('count'))
        .order_by(F.col('count').desc());

    assertEquals(q.toSQL(), `
      SELECT
        island,
        COUNT(*) AS count
      FROM
        penguins
      GROUP BY
        island
      ORDER BY
        count DESC`);
    assertEquals(q.toString(), `
        XQL.from("penguins")
          .select(F.col("species"), F.col("island"))
          .group_by(F.col("island"))
          .agg(F.count(F.col("*")).alias("count"))
          .order_by(F.col("count").desc())
            `);
});

test("multiple joins", () => {
    const t1 = XQL.from("table1").select("a", "b");
    const t2 = XQL.from("table2").filter(F.col("c").gt(10));
    const t3 = XQL.from("table3").group_by("d").agg(F.sum("e").alias("total_e"));
    const t4 = XQL.from("table4");

    const q = t1
        .join(t2, F.col("a").eq(F.col("c")))
        .join(t3, F.col("b").eq(F.col("d")))
        .join(t4, F.col("a").eq(F.col("f")));

    assertEquals(q.toSQL(), `
        SELECT
          a,
          b
        FROM
          table1
          INNER JOIN (
            SELECT
              *
            FROM
              table2
            WHERE
              (c > 10)
          ) AS t0 ON (a = c)
          INNER JOIN (
            SELECT
              d,
              SUM(e) AS total_e
            FROM
              table3
            GROUP BY
              d
          ) AS t1 ON (b = d)
          INNER JOIN table4 ON (a = f)
    `);

    assertEquals(q.toString(), `
        const t0 = XQL.from("table2").filter(F.col("c").gt(F.lit(10)));
        const t1 = XQL.from("table3").group_by(F.col("d")).agg(F.sum(F.col("e")).alias("total_e"));
        const t2 = XQL.from("table4");
        XQL.from("table1")
          .select(F.col("a"), F.col("b"))
          .join(t0, F.col("a").eq(F.col("c")), "inner")
          .join(t1, F.col("b").eq(F.col("d")), "inner")
          .join(t2, F.col("a").eq(F.col("f")), "inner")
    `);
});

console.log("All tests passed!");
