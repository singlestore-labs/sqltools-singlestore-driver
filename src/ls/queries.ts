import queryFactory from '@sqltools/base-driver/dist/lib/factory';
import { IBaseQueries, ContextValue, NSDatabase } from '@sqltools/types';

function escapeTableName(table: Partial<NSDatabase.ITable> | string) {
  let items: string[] = [];
  let tableObj = typeof table === 'string' ? <NSDatabase.ITable>{ label: table } : table;
  // TODO: escape ` sign
  //tableObj.schema && items.push(`\`${tableObj.schema}\``);
  items.push(`\`${tableObj.label}\``);
  return items.join('.');
}

export const describeTable: IBaseQueries['describeTable'] = queryFactory`
  DESCRIBE ${p => escapeTableName(p)}
`;

// TODO add different images for different key types
export const fetchColumns: IBaseQueries['fetchColumns'] = queryFactory/*sql*/`
SELECT
  C.COLUMN_NAME AS label,
  '${ContextValue.COLUMN}' as "type",
  C.TABLE_NAME AS "table",
  C.DATA_TYPE AS "dataType",
  CAST(C.CHARACTER_MAXIMUM_LENGTH AS UNSIGNED) AS size,
  C.DATA_TYPE AS "detail",
  C.TABLE_CATALOG AS "catalog",
  C.TABLE_SCHEMA AS "database",
  C.TABLE_SCHEMA AS "schema",
  C.COLUMN_DEFAULT AS "defaultValue",
  C.IS_NULLABLE AS "isNullable",
  (CASE WHEN C.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END) AS "isPk",
  0 AS "isFk"
FROM
  INFORMATION_SCHEMA.COLUMNS AS C
  LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU ON (
    C.TABLE_NAME = KCU.TABLE_NAME
    AND C.TABLE_SCHEMA = KCU.TABLE_SCHEMA
    ${p => p.catalog ? 'AND C.TABLE_CATALOG = KCU.TABLE_CATALOG' : ''}
    AND C.COLUMN_NAME = KCU.COLUMN_NAME
  )
  JOIN INFORMATION_SCHEMA.TABLES AS T ON C.TABLE_NAME = T.TABLE_NAME
  AND C.TABLE_SCHEMA = T.TABLE_SCHEMA
  ${p => p.catalog ? 'AND C.TABLE_CATALOG = T.TABLE_CATALOG' : ''}
WHERE
  C.TABLE_SCHEMA = '${p => p.schema}'
  AND C.TABLE_NAME = '${p => p.label}'
  ${p => p.catalog ? `AND C.TABLE_CATALOG = '${p.catalog}'` : ''}
ORDER BY
  C.TABLE_NAME,
  C.ORDINAL_POSITION
`;

// TODO allow fetching only first page
export const fetchRecords: IBaseQueries['fetchRecords'] = queryFactory`
SELECT *
FROM ${p => escapeTableName(p.table)}
LIMIT ${p => p.limit || 50}
OFFSET ${p => p.offset || 0};
`;

export const countRecords: IBaseQueries['countRecords'] = queryFactory`
SELECT COUNT(1) AS total
FROM ${p => escapeTableName(p.table)}
`;

export const fetchFunctions: IBaseQueries['fetchFunctions'] = queryFactory`
SELECT
SPECIFIC_NAME AS label,
'${ContextValue.FUNCTION}' AS "type",
ROUTINE_SCHEMA AS "schema",
ROUTINE_SCHEMA AS "database"
FROM INFORMATION_SCHEMA.ROUTINES AS R
WHERE
  R.ROUTINE_SCHEMA = '${p => p.database}'
  and R.ROUTINE_TYPE = 'FUNCTION'
ORDER BY R.SPECIFIC_NAME
;`;

export const fetchProcedures: IBaseQueries['fetchFunctions'] = queryFactory`
SELECT
SPECIFIC_NAME AS label,
'${ContextValue.FUNCTION}' AS "type",
ROUTINE_SCHEMA AS "schema",
ROUTINE_SCHEMA AS "database"
FROM INFORMATION_SCHEMA.ROUTINES AS R
WHERE
  R.ROUTINE_SCHEMA = '${p => p.database}'
  and R.ROUTINE_TYPE = 'PROCEDURE'
ORDER BY R.SPECIFIC_NAME 
;`;

const fetchTablesAndViews = (type: ContextValue, tableType = 'BASE TABLE'): IBaseQueries['fetchTables'] => queryFactory`
SELECT
  T.TABLE_NAME AS label,
  '${type}' as type,
  T.TABLE_SCHEMA AS "schema",
  T.TABLE_SCHEMA AS "database",
  T.TABLE_CATALOG AS "catalog",
  ${type === ContextValue.VIEW ? 1 : 0} AS isView
FROM
  INFORMATION_SCHEMA.TABLES AS T
WHERE
  T.TABLE_SCHEMA = '${p => p.database}'
  ${p => p.catalog ? `AND T.TABLE_CATALOG = '${p.catalog}'` : ''}
  AND UPPER(T.TABLE_TYPE) = '${tableType.toUpperCase()}'
ORDER BY
  T.TABLE_NAME
`;

export const fetchTables: IBaseQueries['fetchTables'] = fetchTablesAndViews(ContextValue.TABLE);
export const fetchViews: IBaseQueries['fetchTables'] = fetchTablesAndViews(ContextValue.VIEW, 'VIEW');

export const fetchDatabases: IBaseQueries['fetchDatabases'] = queryFactory`
SELECT
  schema_name as "label",
  schema_name as "database",
  catalog_name as "catalog",
  '${ContextValue.DATABASE}' as "type",
  'database' as "detail"
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'cluster', 'memsql')
ORDER BY
  schema_name
`;

export const searchTables: IBaseQueries['searchTables'] = queryFactory`
SELECT
  T.TABLE_NAME AS label,
  (CASE WHEN T.TABLE_TYPE = 'BASE TABLE' THEN '${ContextValue.TABLE}' ELSE '${ContextValue.VIEW}' END) as type,
  T.TABLE_SCHEMA AS "schema",
  T.TABLE_SCHEMA AS "database",
  T.TABLE_CATALOG AS "catalog",
  (CASE WHEN T.TABLE_TYPE = 'BASE TABLE' THEN 0 ELSE 1 END) AS "isView",
  (CASE WHEN T.TABLE_TYPE = 'BASE TABLE' THEN 'table' ELSE 'view' END) AS description,
  CONCAT(T.TABLE_SCHEMA, '.', T.TABLE_NAME) AS detail
FROM
  INFORMATION_SCHEMA.TABLES AS T
WHERE
  T.TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'sys', 'mysql')
  ${p => p.search ? `AND (
    CONCAT(T.TABLE_SCHEMA, '.', T.TABLE_NAME) LIKE '%${p.search}%'
    OR CONCAT('"', T.TABLE_SCHEMA, '"."', T.TABLE_NAME, '"') LIKE '%${p.search}%'
    OR T.TABLE_NAME LIKE '%${p.search}%'
  )` : ''}
ORDER BY
  T.TABLE_NAME
LIMIT ${p => p.limit || 100};
`;

export const searchColumns: IBaseQueries['searchColumns'] = queryFactory`
SELECT
  C.COLUMN_NAME AS label,
  '${ContextValue.COLUMN}' as "type",
  C.TABLE_NAME AS "table",
  C.DATA_TYPE AS "dataType",
  CAST(C.CHARACTER_MAXIMUM_LENGTH AS UNSIGNED) AS size,
  C.TABLE_CATALOG AS "catalog",
  C.TABLE_SCHEMA AS "database",
  C.TABLE_SCHEMA AS "schema",
  C.COLUMN_DEFAULT AS "defaultValue",
  C.IS_NULLABLE AS "isNullable",
  (CASE WHEN C.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END) AS "isPk",
  0 AS "isFk"
FROM
  INFORMATION_SCHEMA.COLUMNS AS C
  LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU ON (
    C.TABLE_NAME = KCU.TABLE_NAME
    AND C.TABLE_SCHEMA = KCU.TABLE_SCHEMA
    AND C.COLUMN_NAME = KCU.COLUMN_NAME
    AND (C.TABLE_CATALOG IS NULL OR C.TABLE_CATALOG = KCU.TABLE_CATALOG)
  )
  JOIN INFORMATION_SCHEMA.TABLES AS T ON C.TABLE_NAME = T.TABLE_NAME
  AND C.TABLE_SCHEMA = T.TABLE_SCHEMA
  AND (C.TABLE_CATALOG IS NULL OR C.TABLE_CATALOG = T.TABLE_CATALOG)
WHERE
  C.TABLE_SCHEMA NOT IN ('information_schema', 'memsql', 'cluster')
  ${p => p.tables.filter(t => !!t.label).length
    ? `AND LOWER(C.TABLE_NAME) IN (${p.tables.filter(t => !!t.label).map(t => `'${t.label}'`.toLowerCase()).join(', ')})`
    : ''
  }
  ${p => p.search
    ? `AND (
      CONCAT(C.TABLE_NAME, '.', C.COLUMN_NAME) LIKE '%${p.search}%'
      OR C.COLUMN_NAME LIKE '%${p.search}%'
    )`
    : ''
  }
ORDER BY
  C.TABLE_NAME,
  C.ORDINAL_POSITION
LIMIT ${p => p.limit || 100}

`;