import AbstractDriver from '@sqltools/base-driver';
import * as Queries from './queries';
import MySQLLib from 'mysql';
import { countBy } from 'lodash';
import { IConnectionDriver, NSDatabase, Arg0, MConnectionExplorer, ContextValue, IQueryOptions } from '@sqltools/types';
import keywordsCompletion from './keywords';
import { v4 as generateId } from 'uuid';
import parse from './parse';

const toBool = (v: any) => v && (v.toString() === '1' || v.toString().toLowerCase() === 'true' || v.toString().toLowerCase() === 'yes');

export default class SingleStoreDB<O = any> extends AbstractDriver<any, O> implements IConnectionDriver {
  queries = Queries;

  public open() {
    if (this.connection) {
      return this.connection;
    }

    const pool = MySQLLib.createPool(this.credentials.connectString || {
      database: this.credentials.database,
      host: this.credentials.server,
      port: this.credentials.port,
      password: this.credentials.password,
      user: this.credentials.username,
      ssl: this.credentials.ssl,
      multipleStatements: true,
      dateStrings: true,
      bigNumberStrings: true,
      supportBigNumbers: true,
    });

    return new Promise<MySQLLib.Pool>((resolve, reject) => {
      pool.getConnection((err, conn) => {
        if (err) return reject(err);
        conn.ping(error => {
          if (error) return reject(error);
          this.connection = Promise.resolve(pool);
          conn.release();
          return resolve(this.connection);
        });
      });
    });
  }

  public close() {
    if (!this.connection) return Promise.resolve();

    return this.connection.then((pool) => {
      return new Promise<void>((resolve, reject) => {
        pool.end((err) => {
          if (err) return reject(err);
          this.connection = null;
          return resolve();
        });
      });
    });
  }

  public query: (typeof AbstractDriver)['prototype']['query'] = (query, opt = {}) => {
    return this.open().then((conn): Promise<NSDatabase.IResult[]> => {
      const { requestId } = opt;
      const queries = parse(query.toString());
      return Promise.all(queries.map((query): Promise<NSDatabase.IResult> => {
        return new Promise((resolve, reject) => {
          let limitedQuery = query.toString().trim().toLowerCase().startsWith('select') ?
            "SELECT * FROM (" + query.toString() + ") LIMIT " + this.credentials.previewLimit :
            query.toString();

          conn.query({ sql: limitedQuery, nestTables: true }, (error, results, fields) => {
            if (error) reject(error);
            const r = results || [];
            const messages = [];
            if (r.affectedRows) {
              messages.push(`${r.affectedRows} rows were affected.`);
            }
            if (r.changedRows) {
              messages.push(`${r.changedRows} rows were changed.`);
            }
            if (fields) {
              // TODO: understand, why this is needed
              fields = fields.filter(field => typeof field !== 'undefined');
            }
            const res: NSDatabase.IResult = {
              connId: this.getId(),
              requestId,
              resultId: generateId(), // TODO: understand, why this is needed
              cols: fields && Array.isArray(fields) ? this.getColumnNames(fields) : [],
              messages,
              query: query,
              results: Array.isArray(r) ? this.mapRows(r, fields) : [],
              pageSize: Array.isArray(r) ? r.length : 0,
            }
            resolve(res)
          });
        })
      }))
    }).catch(err => {
      if (opt.throwIfError) {
        throw new Error(err.message);
      }
      return [<NSDatabase.IResult>{
        connId: this.getId(),
        requestId: opt.requestId,
        resultId: generateId(),
        cols: [],
        messages: [
          this.prepareMessage([
            (err && err.message || err.toString()),
          ].filter(Boolean).join(' '))
        ],
        error: true,
        rawError: err,
        query,
        results: [],
      }];
    });
  }

  public async showRecords(table: NSDatabase.ITable, opt: IQueryOptions & { limit: number, page?: number }) {
    const params = { limit: this.credentials.previewLimit, table, offset: 0 };
    const [records, totalResult] = await (Promise.all([
      this.singleQuery(this.queries.fetchRecords(params), opt),
      this.singleQuery(this.queries.countRecords(params), opt),
    ]));
    records.baseQuery = this.queries.fetchRecords.raw;
    records.pageSize = Number((totalResult.results[0] as any).total);
    records.page = 0;
    records.total = Number((totalResult.results[0] as any).total);
    records.queryType = 'showRecords';
    records.queryParams = table;
    return [records];
  }

  private getColumnNames(fields: MySQLLib.FieldInfo[] = []): string[] {
    const count = countBy(fields, ({ name }) => name);
    return fields.map(({ table, name }) => count[name] > 1 ? `${table}.${name}` : name);
  }

  private mapRows(rows: any[] = [], fields: MySQLLib.FieldInfo[] = []): any[] {
    const names = this.getColumnNames(fields);
    return rows.map((row) => fields.reduce((r, { table, name }, i) => ({ ...r, [names[i]]: this.castResultsIfNeeded(row[table][name]) }), {}));
  }

  private castResultsIfNeeded(data: any) {
    if (!Buffer.isBuffer(data)) return data;
    return Buffer.from(data).toString('hex');
  }

  public async getChildrenForItem({ item, parent }: Arg0<IConnectionDriver['getChildrenForItem']>) {
    switch (item.type) {
      case ContextValue.CONNECTION:
      case ContextValue.CONNECTED_CONNECTION:
        return this.queryResults(this.queries.fetchDatabases(item))
      case ContextValue.DATABASE:
        return <MConnectionExplorer.IChildItem[]>[
          { label: 'Tables', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.TABLE },
          { label: 'Views', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.VIEW },
          { label: 'Functions', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.FUNCTION },
          { label: 'Procedures', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.FUNCTION },
        ];
      case ContextValue.RESOURCE_GROUP:
        return this.getChildrenForGroup({ item, parent });
      case ContextValue.TABLE:
      case ContextValue.VIEW:
        return this.getColumns(item as NSDatabase.ITable);
    }
    return [];
  }

  private async getChildrenForGroup({ parent, item }: Arg0<IConnectionDriver['getChildrenForItem']>) {
    switch (item.childType) {
      case ContextValue.TABLE:
        return this.queryResults(this.queries.fetchTables(parent as NSDatabase.ISchema)).then(res => res.map(t => ({ ...t, isView: toBool(t.isView) })));
      case ContextValue.VIEW:
        return this.queryResults(this.queries.fetchViews(parent as NSDatabase.ISchema)).then(res => res.map(t => ({ ...t, isView: toBool(t.isView) })));
      case ContextValue.FUNCTION:
        if (item.label === 'Functions') {
          return this.queryResults(this.queries.fetchFunctions(parent as NSDatabase.ISchema));
        }
        return this.queryResults(this.queries.fetchProcedures(parent as NSDatabase.ISchema));

    }
    return [];
  }

  private async getColumns(parent: NSDatabase.ITable): Promise<NSDatabase.IColumn[]> {
    const results = await this.queryResults(this.queries.fetchColumns(parent));
    return results.map((obj) => {
      obj.isPk = toBool(obj.isPk);
      obj.isFk = toBool(obj.isFk);

      return <NSDatabase.IColumn>{
        ...obj,
        isNullable: toBool(obj.isNullable),
        iconName: obj.isPk ? 'pk' : (obj.isFk ? 'fk' : null),
        childType: ContextValue.NO_CHILD,
        table: parent
      };
    });
  }


  public searchItems(itemType: ContextValue, search: string, extraParams: any = {}): Promise<NSDatabase.SearchableItem[]> {
    switch (itemType) {
      case ContextValue.TABLE:
        return this.queryResults(this.queries.searchTables({ search })).then(r => r.map(t => {
          t.isView = toBool(t.isView);
          return t;
        }));
      case ContextValue.COLUMN:
        return this.queryResults(this.queries.searchColumns({ search, ...extraParams })).then(r => r.map(c => {
          c.isFk = toBool(c.isFk);
          c.isFk = toBool(c.isFk);
          return c;
        }));
    }
  }

  public getStaticCompletions = async () => {
    return keywordsCompletion;
  }
}