import { XQL, F, c } from './index.js';

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (e: any) {
        console.error(`❌ ${name}`);
        console.error(e);
        process.exit(1);
    }
}

function assertEquals(a: string, b: string) {
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
          .select(c("a"), c("b"))
    `);
});

test("select with alias", () => {
    const q = XQL.from("my_table").select(c("a").alias("my_a"));
    assertEquals(q.toSQL(), `
        SELECT
          a AS my_a
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(c("a").alias("my_a"))
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
          .select(c("island"))
    `);
});

test("sequential select with wildcard", () => {
    const q = XQL.from("penguins")
        .select(c("*"))
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
          .select(c("species"), c("island"))
    `);
});

test("sequential select with wildcard at the end", () => {
    const q = XQL.from("penguins")
        .select("species", "island")
        .select(c("*"));

    assertEquals(q.toSQL(), `
        SELECT
          species,
          island
        FROM
          penguins
    `);
    assertEquals(q.toString(), `
        XQL.from("penguins")
          .select(c("species"), c("island"))
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
    const q = XQL.from("my_table").filter(c("a").gt(10));
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
          .filter(c("a").gt(F.lit(10)))
    `);
});

test("filter with and", () => {
    const q = XQL.from("my_table").filter(c("a").gt(10).and(c("b").lt(5)));
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
          .filter(c("a").gt(F.lit(10)).and(c("b").lt(F.lit(5))))
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
          .group_by(c("a"))
          .agg(F.sum(c("b")).alias("total_b"))
    `);
});

test("order_by", () => {
    const q = XQL.from("my_table").order_by(c("a").desc());
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
          .order_by(c("a").desc())
    `);
});

test("join", () => {
    const t1 = XQL.from("table1");
    const t2 = XQL.from("table2");
    const q = t1.join(t2, c("a").eq(c("b")));
    assertEquals(q.toSQL(), `
        SELECT
          *
        FROM
          table1
          INNER JOIN table2 ON (a = b)
    `);
    assertEquals(q.toString(), `const t0 = XQL.from("table2");
XQL.from("table1")\n  .join(t0, c("a").eq(c("b")), "inner")`);
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
          .group_by(c("country"), c("city"))
          .agg(F.count(c("*")).alias("city_count"));
        XQL.from(t0)
          .group_by(c("country"))
          .agg(F.count(c("*")).alias("distinct_cities"))
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
          .select(c("species"), c("island"))
          .group_by(c("island"))
          .agg(F.count(c("*")).alias("count"))
          .order_by(c("count").desc())
            `);
});

test("multiple joins", () => {
    const t1 = XQL.from("table1").select("a", "b");
    const t2 = XQL.from("table2").filter(c("c").gt(10));
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
        const t0 = XQL.from("table2").filter(c("c").gt(F.lit(10)));
        const t1 = XQL.from("table3").group_by(c("d")).agg(F.sum(c("e")).alias("total_e"));
        const t2 = XQL.from("table4");
        XQL.from("table1")
          .select(c("a"), c("b"))
          .join(t0, c("a").eq(c("c")), "inner")
          .join(t1, c("b").eq(c("d")), "inner")
          .join(t2, c("a").eq(c("f")), "inner")
    `);
});

test("double group by", () => {
    const q = XQL.from('penguins')
        .group_by("species")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc())
        .group_by("count")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc());

    assertEquals(q.toSQL(), `
        SELECT
          count,
          COUNT(*) AS count
        FROM
          (
            SELECT
              species,
              COUNT(*) AS count
            FROM
              penguins
            GROUP BY
              species
          ) AS t0
        GROUP BY
          count
        ORDER BY
          count DESC
    `);

    assertEquals(q.toString(), `
        const t0 = XQL.from("penguins")
          .group_by(c("species"))
          .agg(F.count(c("*")).alias("count"))
          .order_by(c("count").desc());
        XQL.from(t0)
          .group_by(c("count"))
          .agg(F.count(c("*")).alias("count"))
          .order_by(c("count").desc())
    `);
});

test("triple chained group_by", () => {
    const q = XQL.from("penguins")
        .group_by("island", "bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc())
        .group_by("bill_length_mm")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc())
        .group_by("count")
        .agg(F.count('*').alias('count_count'))
        .order_by(c('count_count').desc());

    assertEquals(q.toSQL(), `
        SELECT
          count,
          COUNT(*) AS count_count
        FROM
          (
            SELECT
              bill_length_mm,
              COUNT(*) AS count
            FROM
              (
                SELECT
                  island,
                  bill_length_mm,
                  bill_depth_mm,
                  flipper_length_mm,
                  body_mass_g,
                  COUNT(*) AS count
                FROM
                  penguins
                GROUP BY
                  island,
                  bill_length_mm,
                  bill_depth_mm,
                  flipper_length_mm,
                  body_mass_g
              ) AS t1
            GROUP BY
              bill_length_mm
          ) AS t0
        GROUP BY
          count
        ORDER BY
          count_count DESC
    `);

    assertEquals(q.toString(), `const t0 = XQL.from("penguins")
  .group_by(c("island"), c("bill_length_mm"), c("bill_depth_mm"), c("flipper_length_mm"), c("body_mass_g"))
  .agg(F.count(c("*")).alias("count"))
  .order_by(c("count").desc());
const t0 = XQL.from(t0)
  .group_by(c("bill_length_mm"))
  .agg(F.count(c("*")).alias("count"))
  .order_by(c("count").desc());
XQL.from(t0)
  .group_by(c("count"))
  .agg(F.count(c("*")).alias("count_count"))
  .order_by(c("count_count").desc())`);
});

test("select after group_by and agg", () => {
    const q = XQL.from("penguins")
        .group_by("species", "island", "bill_length_mm")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc())
        .select("species", "island");

    assertEquals(q.toSQL(), `
        SELECT
          species,
          island
        FROM
          (
            SELECT
              species,
              island,
              bill_length_mm,
              COUNT(*) AS count
            FROM
              penguins
            GROUP BY
              species,
              island,
              bill_length_mm
          ) AS t0
    `);
    assertEquals(q.toString(), `
    const t0 = XQL.from("penguins")
      .group_by(c("species"), c("island"), c("bill_length_mm"))
      .agg(F.count(c("*")).alias("count"))
      .order_by(c("count").desc());
    XQL.from(t0)
      .select(c("species"), c("island"))`);
});

test("plus operator for concatenation and addition", () => {
    const q = XQL.from("my_table").select(
        c("first_name").plus(" ").plus(c("last_name")).alias("full_name"),
        c("price").plus(c("tax")).alias("total_price")
    );
    assertEquals(q.toSQL(), `
        SELECT
          ((first_name + ' ') + last_name) AS full_name,
          (price + tax) AS total_price
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(c("first_name").plus(F.lit(" ")).plus(c("last_name")).alias("full_name"), c("price").plus(c("tax")).alias("total_price"))
    `);
});

test("cast expression", () => {
    const q = XQL.from("my_table").select(
        c("age_string").cast("INTEGER").alias("age_int"),
        c("price").cast("VARCHAR").alias("price_str")
    );
    assertEquals(q.toSQL(), `
        SELECT
          TRY_CAST(age_string AS INTEGER) AS age_int,
          TRY_CAST(price AS VARCHAR) AS price_str
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(c("age_string").cast("INTEGER").alias("age_int"), c("price").cast("VARCHAR").alias("price_str"))
    `);
});

test("column with space in name", () => {
    const q = XQL.from("my_table")
        .select(c("first name"))
        .filter(c("first name").eq("Ben"));
    assertEquals(q.toSQL(), `
        SELECT
          "first name"
        FROM
          my_table
        WHERE
          ("first name" = 'Ben')
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table").select(c("first name")).filter(c("first name").eq(F.lit("Ben")))
    `);
});

test("with_columns to add a new column", () => {
    const q = XQL.from("my_table")
        .with_columns(c("a").plus(c("b")).alias("a_plus_b"));

    assertEquals(q.toSQL(), `
        SELECT
          * REPLACE((a + b) AS a_plus_b)
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table").with_columns(c("a").plus(c("b")).alias("a_plus_b"))
    `);
});

test("with_columns to overwrite an existing column", () => {
    const q = XQL.from("my_table")
        .with_columns(c("a").plus(1).alias("a"));

    assertEquals(q.toSQL(), `
      SELECT
        * REPLACE((a + 1) AS a)
      FROM
        my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table").with_columns(c("a").plus(F.lit(1)).alias("a"))
    `);
});

test("chained with_columns", () => {
    const q = XQL.from("penguins")
        .with_columns(c("bill_length_mm").cast("FLOAT").alias("bill_length_mm"))
        .with_columns(c("flipper_length_mm").cast("INTEGER").alias("flipper_length_mm"));

    assertEquals(q.toSQL(), `
        SELECT
          * REPLACE (TRY_CAST(flipper_length_mm AS INTEGER) AS flipper_length_mm)
        FROM
          (
            SELECT
              * REPLACE (TRY_CAST(bill_length_mm AS FLOAT) AS bill_length_mm)
            FROM
              penguins
          ) AS t0
    `);
    assertEquals(q.toString(), `
        const t0 = XQL.from("penguins").with_columns(c("bill_length_mm").cast("FLOAT").alias("bill_length_mm"));
        XQL.from(t0).with_columns(c("flipper_length_mm").cast("INTEGER").alias("flipper_length_mm"))
    `);
});

test("with_columns followed by select", () => {
    const q = XQL.from('penguins')
        .with_columns(
            c("bill_length_mm").cast("FLOAT").alias("bill_length_mm"),
            c("bill_depth_mm").cast("FLOAT").alias("bill_depth_mm")
        )
        .select("species", "island", "bill_length_mm");

    assertEquals(q.toSQL(), `
        SELECT
            species,
            island,
            bill_length_mm
        FROM
            (
                SELECT
                    * REPLACE (TRY_CAST(bill_length_mm AS FLOAT) AS bill_length_mm, TRY_CAST(bill_depth_mm AS FLOAT) AS bill_depth_mm)
                FROM
                    penguins
            ) AS t0
    `);
});


test("filter, order_by, then group_by", () => {
    const q = XQL.from('_2025_LoL_esports_match_data_from_OraclesElixir')
        .filter(c("position").eq("team"))
        .order_by(c("patch").desc())
        .group_by("league")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc());

    assertEquals(q.toSQL(), `
        SELECT
          league,
          COUNT(*) AS count
        FROM
          (
            SELECT
              *
            FROM
              _2025_LoL_esports_match_data_from_OraclesElixir
            WHERE
              (position = 'team')
          ) AS t0
        GROUP BY
          league
        ORDER BY
          count DESC
    `);

    assertEquals(q.toString(), `const t0 = XQL.from("_2025_LoL_esports_match_data_from_OraclesElixir")
  .filter(c("position").eq(F.lit("team")))
  .order_by(c("patch").desc());
XQL.from(t0)
  .group_by(c("league"))
  .agg(F.count(c("*")).alias("count"))
  .order_by(c("count").desc())`);
});
test("filter, order_by, then group_by without final order_by", () => {
    const q = XQL.from('_2025_LoL_esports_match_data_from_OraclesElixir')
        .filter(c("position").eq("team"))
        .order_by(c("patch").desc())
        .group_by("league")
        .agg(F.count('*').alias('count'));

    assertEquals(q.toSQL(), `
        SELECT
          league,
          COUNT(*) AS count
        FROM
          (
            SELECT
              *
            FROM
              _2025_LoL_esports_match_data_from_OraclesElixir
            WHERE
              (position = 'team')
          ) AS t0
        GROUP BY
          league
    `);
});

test("new comparison operators", () => {
    // is_null
    const q1 = XQL.from("my_table").filter(c("a").is_null());
    assertEquals(q1.toSQL(), `
        SELECT * FROM my_table WHERE (a IS NULL)
    `);
    assertEquals(q1.toString(), `
        XQL.from("my_table").filter(c("a").is_null())
    `);

    // is_not_null
    const q2 = XQL.from("my_table").filter(c("a").is_not_null());
    assertEquals(q2.toSQL(), `
        SELECT * FROM my_table WHERE (a IS NOT NULL)
    `);
    assertEquals(q2.toString(), `
        XQL.from("my_table").filter(c("a").is_not_null())
    `);

    // neq
    const q3 = XQL.from("my_table").filter(c("a").neq(10));
    assertEquals(q3.toSQL(), `
        SELECT * FROM my_table WHERE (a <> 10)
    `);
    assertEquals(q3.toString(), `
        XQL.from("my_table").filter(c("a").neq(F.lit(10)))
    `);

    // is_distinct_from
    const q4 = XQL.from("my_table").filter(c("a").is_distinct_from("b"));
    assertEquals(q4.toSQL(), `
        SELECT * FROM my_table WHERE (a IS DISTINCT FROM 'b')
    `);
    assertEquals(q4.toString(), `
        XQL.from("my_table").filter(c("a").is_distinct_from(F.lit("b")))
    `);

    // is_not_distinct_from
    const q5 = XQL.from("my_table").filter(c("a").is_not_distinct_from(c("b")));
    assertEquals(q5.toSQL(), `
        SELECT * FROM my_table WHERE (a IS NOT DISTINCT FROM b)
    `);
    assertEquals(q5.toString(), `
        XQL.from("my_table").filter(c("a").is_not_distinct_from(c("b")))
    `);

    // between
    const q6 = XQL.from("my_table").filter(c("a").between(10, 20));
    assertEquals(q6.toSQL(), `
        SELECT * FROM my_table WHERE (a BETWEEN 10 AND 20)
    `);
    assertEquals(q6.toString(), `
        XQL.from("my_table").filter(c("a").between(F.lit(10), F.lit(20)))
    `);
});

test("shorthand 'c' and F.col are interchangeable", () => {
    const q1 = XQL.from("my_table").select(c("a"));
    assertEquals(q1.toSQL(), `
        SELECT
          a
        FROM
          my_table
    `);
    assertEquals(q1.toString(), `
        XQL.from("my_table").select(c("a"))
    `);

    const q2 = XQL.from("my_table").select(F.col("a"));
    assertEquals(q2.toSQL(), `
        SELECT
            a
        FROM
            my_table
    `);
    assertEquals(q2.toString(), `
        XQL.from("my_table").select(c("a"))
    `);
});

test("agg after group_by, agg, and order_by", () => {
    const q = XQL.from('_2025_LoL_esports_match_data_from_OraclesElixir')
        .group_by("gameid")
        .agg(F.count('*').alias('count'))
        .order_by(c('count').desc())
        .agg(F.count('*').alias('count'));

    assertEquals(q.toSQL(), `
        SELECT
          COUNT(*) AS count
        FROM
          (
            SELECT
              gameid,
              COUNT(*) AS count
            FROM
              _2025_LoL_esports_match_data_from_OraclesElixir
            GROUP BY
              gameid
          ) AS t0
    `);

    assertEquals(q.toString(), `
        const t0 = XQL.from("_2025_LoL_esports_match_data_from_OraclesElixir")
          .group_by(c("gameid"))
          .agg(F.count(c("*")).alias("count"))
          .order_by(c("count").desc());
        XQL.from(t0)
          .agg(F.count(c("*")).alias("count"))
    `);
});


test("distinct", () => {
    const q = XQL.from("my_table").select("a", "b").distinct();
    assertEquals(q.toSQL(), `
        SELECT DISTINCT
          a,
          b
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(c("a"), c("b"))
          .distinct()
    `);
});

test("distinct on", () => {
    const q = XQL.from("my_table").select("a", "b").distinct("a");
    assertEquals(q.toSQL(), `
        SELECT DISTINCT ON (a)
          a,
          b
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .select(c("a"), c("b"))
          .distinct(c("a"))
    `);
});

test("distinct on with no select", () => {
    const q = XQL.from("my_table").distinct("a");
    assertEquals(q.toSQL(), `
        SELECT DISTINCT ON (a)
          *
        FROM
          my_table
    `);
    assertEquals(q.toString(), `
        XQL.from("my_table")
          .distinct(c("a"))
    `);
});

test("distinct then agg", () => {
    const q = XQL.from("penguins")
        .distinct("species")
        .agg(F.count('*').alias('count'));

    assertEquals(q.toSQL(), `
        SELECT
          COUNT(*) AS count
        FROM
          (
            SELECT DISTINCT ON (species)
              *
            FROM
              penguins
          ) AS t0
    `);

    assertEquals(q.toString(), `const t0 = XQL.from("penguins")
  .distinct(c("species"));
XQL.from(t0)
  .agg(F.count(c("*")).alias("count"))`);
});

console.log("All tests passed!");
