/**
 * node:sqlite 的最小类型声明。
 *
 * 项目当前安装的是 @types/node v20，尚未包含 Node 22 的 node:sqlite。
 * 这里只声明本项目实际用到的 API，查询结果由调用方断言为具体形状。
 * 若后续把 @types/node 升到 v22+，可直接删除本文件。
 */
declare module "node:sqlite" {
  export interface StatementSync {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(
      path: string,
      options?: {
        readOnly?: boolean;
        enableForeignKeyConstraints?: boolean;
        timeout?: number;
      },
    );
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}
