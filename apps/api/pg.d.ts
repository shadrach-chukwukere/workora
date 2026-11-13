declare module 'pg' {
import * as events from 'events';

export class Client extends events.EventEmitter {
constructor(config?: string | ClientConfig);
connect(): Promise;
connect(callback: (err: Error | undefined) => void): void;
query(queryText: string, values?: any[]): Promise;
query(queryText: string, callback: (err: Error, result: QueryResult) => void): void;
end(): Promise;
end(callback: (err: Error | undefined) => void): void;
}

export class Pool extends events.EventEmitter {
constructor(config?: PoolConfig);
query(queryText: string, values?: any[]): Promise;
query(queryText: string, callback: (err: Error, result: QueryResult) => void): void;
connect(): Promise;
end(): Promise;
}

export interface ClientConfig {
connectionString?: string;
host?: string;
port?: number;
user?: string;
password?: string;
database?: string;
ssl?: boolean | object;
}

export interface PoolConfig extends ClientConfig {
max?: number;
idleTimeoutMillis?: number;
}

export interface PoolClient extends Client {
release(release?: boolean | Error): void;
}

export interface QueryResult {
command: string;
rowCount: number;
oid: number;
rows: any[];
}
}