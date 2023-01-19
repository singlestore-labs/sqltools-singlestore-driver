import AbstractDriver from '@sqltools/base-driver';
import queries from './queries';
import { IConnectionDriver, MConnectionExplorer, NSDatabase, ContextValue, Arg0 } from '@sqltools/types';
import { v4 as generateId } from 'uuid';
import MySQLLib, { QueryOptions } from 'mysql2/promise';
import { countBy } from 'lodash';

export default class SingleStoreDB extends AbstractDriver<MySQLLib.Pool, MySQLLib.PoolOptions> implements IConnectionDriver {

  queries = queries;

  public async open() {
    if (this.connection) {
      return this.connection;
    }

    const pool = MySQLLib.createPool({
      // TODO: add parameter for connection timeout
      connectTimeout: 1000,
      database: this.credentials.database,
      host: this.credentials.server,
      port: this.credentials.port,
      password: this.credentials.password,
      user: this.credentials.username,
      multipleStatements: true,
      dateStrings: true,
      bigNumberStrings: true,
      supportBigNumbers: true,
    });

    return new Promise<MySQLLib.Pool>((resolve, reject) => {
      return pool.getConnection().then((conn) => {
        conn.ping().then(() => {
          this.connection = Promise.resolve(pool);
          return resolve(this.connection)
        }, reject)
      }, reject)
    });
  }

  public async close() {
    if (!this.connection)
      return Promise.resolve();

    return this.connection.then((pool) => {
      return new Promise<void>((resolve, reject) => {
        pool.end().then(() => {
          this.connection = null;
          return resolve();
        }, reject)
      });
    });
  }

  public query: (typeof AbstractDriver)['prototype']['query'] = async (query, opt = {}) => {
    return this.open().then((conn): Promise<NSDatabase.IResult[]> => {
      const { requestId } = opt;
      return new Promise((resolve, reject) => {
        const options: QueryOptions = {
          sql: query.toString(),
          nestTables: true, // TODO: understand why it is needed
        }
        conn.query(options, (error, results, fields) => {
          if (error) return reject(error);
          try {
            const queries = query.toString().split(';'); // TODO: Write better parser
            if (results && !Array.isArray(results[0]) && typeof results[0] !== 'undefined') { // TODO: understand why it is needed
              results = [results];
            }
            return resolve(queries.map((q, i): NSDatabase.IResult => {
              const r = results[i] || [];
              const messages = [];
              if (r.affectedRows) {
                messages.push(`${r.affectedRows} rows were affected.`);
              }
              if (r.changedRows) {
                messages.push(`${r.changedRows} rows were changed.`);
              }
              if (fields) {
                fields = fields.filter(field => typeof field !== 'undefined'); // TODO: understand why it is needed
              }
              return {
                connId: this.getId(),
                requestId,
                resultId: generateId(),
                cols: fields && Array.isArray(fields) ? this.getColumnNames(fields) : [],
                messages,
                query: q,
                results: Array.isArray(r) ? this.mapRows(r, fields) : [],
              };
            }));
          } catch (err) {
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
          };
        })
      })
    })
  }

  private getColumnNames(fields: MySQLLib.FieldPacket[] = []): string[] {
    const count = countBy(fields, ({ name }) => name);
    return fields.map(({ table, name }) => count[name] > 1 ? `${table}.${name}` : name);
  }

  private mapRows(rows: any[] = [], fields: MySQLLib.FieldPacket[] = []): any[] {
    const names = this.getColumnNames(fields);
    return rows.map((row) => fields.reduce((r, { table, name }, i) => ({ ...r, [names[i]]: this.castResultsIfNeeded(row[table][name]) }), {}));
  }

  private castResultsIfNeeded(data: any) {
    if (!Buffer.isBuffer(data)) return data;
    return Buffer.from(data).toString('hex');
  }

  public async testConnection() {
    await this.open();
    await this.query('SELECT 1', {});
  }

  /**
   * This method is a helper to generate the connection explorer tree.
   * it gets the child items based on current item
   */
  public async getChildrenForItem({ item, parent }: Arg0<IConnectionDriver['getChildrenForItem']>) {
    switch (item.type) {
      case ContextValue.CONNECTION:
      case ContextValue.CONNECTED_CONNECTION:
        return <MConnectionExplorer.IChildItem[]>[
          { label: 'Tables', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.TABLE },
          { label: 'Views', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.VIEW },
        ];
      case ContextValue.TABLE:
      case ContextValue.VIEW:
        let i = 0;
        return <NSDatabase.IColumn[]>[{
          database: 'fakedb',
          label: `column${i++}`,
          type: ContextValue.COLUMN,
          dataType: 'faketype',
          schema: 'fakeschema',
          childType: ContextValue.NO_CHILD,
          isNullable: false,
          iconName: 'column',
          table: parent,
        }, {
          database: 'fakedb',
          label: `column${i++}`,
          type: ContextValue.COLUMN,
          dataType: 'faketype',
          schema: 'fakeschema',
          childType: ContextValue.NO_CHILD,
          isNullable: false,
          iconName: 'column',
          table: parent,
        }, {
          database: 'fakedb',
          label: `column${i++}`,
          type: ContextValue.COLUMN,
          dataType: 'faketype',
          schema: 'fakeschema',
          childType: ContextValue.NO_CHILD,
          isNullable: false,
          iconName: 'column',
          table: parent,
        }, {
          database: 'fakedb',
          label: `column${i++}`,
          type: ContextValue.COLUMN,
          dataType: 'faketype',
          schema: 'fakeschema',
          childType: ContextValue.NO_CHILD,
          isNullable: false,
          iconName: 'column',
          table: parent,
        }, {
          database: 'fakedb',
          label: `column${i++}`,
          type: ContextValue.COLUMN,
          dataType: 'faketype',
          schema: 'fakeschema',
          childType: ContextValue.NO_CHILD,
          isNullable: false,
          iconName: 'column',
          table: parent,
        }];
      case ContextValue.RESOURCE_GROUP:
        return this.getChildrenForGroup({ item, parent });
    }
    return [];
  }

  /**
   * This method is a helper to generate the connection explorer tree.
   * It gets the child based on child types
   */
  private async getChildrenForGroup({ parent, item }: Arg0<IConnectionDriver['getChildrenForItem']>) {
    console.log({ item, parent });
    switch (item.childType) {
      case ContextValue.TABLE:
      case ContextValue.VIEW:
        let i = 0;
        return <MConnectionExplorer.IChildItem[]>[{
          database: 'fakedb',
          label: `${item.childType}${i++}`,
          type: item.childType,
          schema: 'fakeschema',
          childType: ContextValue.COLUMN,
        }, {
          database: 'fakedb',
          label: `${item.childType}${i++}`,
          type: item.childType,
          schema: 'fakeschema',
          childType: ContextValue.COLUMN,
        },
        {
          database: 'fakedb',
          label: `${item.childType}${i++}`,
          type: item.childType,
          schema: 'fakeschema',
          childType: ContextValue.COLUMN,
        }];
    }
    return [];
  }

  /**
   * This method is a helper for intellisense and quick picks.
   */
  public async searchItems(itemType: ContextValue, search: string, _extraParams: any = {}): Promise<NSDatabase.SearchableItem[]> {
    switch (itemType) {
      case ContextValue.TABLE:
      case ContextValue.VIEW:
        let j = 0;
        return [{
          database: 'fakedb',
          label: `${search || 'table'}${j++}`,
          type: itemType,
          schema: 'fakeschema',
          childType: ContextValue.COLUMN,
        }, {
          database: 'fakedb',
          label: `${search || 'table'}${j++}`,
          type: itemType,
          schema: 'fakeschema',
          childType: ContextValue.COLUMN,
        },
        {
          database: 'fakedb',
          label: `${search || 'table'}${j++}`,
          type: itemType,
          schema: 'fakeschema',
          childType: ContextValue.COLUMN,
        }]
      case ContextValue.COLUMN:
        let i = 0;
        return [
          {
            database: 'fakedb',
            label: `${search || 'column'}${i++}`,
            type: ContextValue.COLUMN,
            dataType: 'faketype',
            schema: 'fakeschema',
            childType: ContextValue.NO_CHILD,
            isNullable: false,
            iconName: 'column',
            table: 'fakeTable'
          }, {
            database: 'fakedb',
            label: `${search || 'column'}${i++}`,
            type: ContextValue.COLUMN,
            dataType: 'faketype',
            schema: 'fakeschema',
            childType: ContextValue.NO_CHILD,
            isNullable: false,
            iconName: 'column',
            table: 'fakeTable'
          }, {
            database: 'fakedb',
            label: `${search || 'column'}${i++}`,
            type: ContextValue.COLUMN,
            dataType: 'faketype',
            schema: 'fakeschema',
            childType: ContextValue.NO_CHILD,
            isNullable: false,
            iconName: 'column',
            table: 'fakeTable'
          }, {
            database: 'fakedb',
            label: `${search || 'column'}${i++}`,
            type: ContextValue.COLUMN,
            dataType: 'faketype',
            schema: 'fakeschema',
            childType: ContextValue.NO_CHILD,
            isNullable: false,
            iconName: 'column',
            table: 'fakeTable'
          }, {
            database: 'fakedb',
            label: `${search || 'column'}${i++}`,
            type: ContextValue.COLUMN,
            dataType: 'faketype',
            schema: 'fakeschema',
            childType: ContextValue.NO_CHILD,
            isNullable: false,
            iconName: 'column',
            table: 'fakeTable'
          }
        ];
    }
    return [];
  }

  public getStaticCompletions: IConnectionDriver['getStaticCompletions'] = async () => {
    return {};
  }
}
