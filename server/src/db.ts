import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Alert, Check, Delivery, FollowUp, Subscriber } from "./types.js";

/**
 * SQLite persistence. Set MAIGUARD_DB to a file path to keep everything across
 * restarts; without it the store is in memory only (tests, and the quick local
 * demo). The server keeps the working set in memory and mirrors it here, so
 * each table is simply id + the record as JSON.
 */
const TABLES = ["alerts", "subscribers", "deliveries", "checks", "follow_ups"] as const;
type Table = (typeof TABLES)[number];

export interface Snapshot {
  alerts: Alert[];
  subscribers: Subscriber[];
  deliveries: Delivery[];
  checks: Check[];
  followUps: FollowUp[];
}

let db: DatabaseSync | null | undefined;

function open(): DatabaseSync | null {
  if (db !== undefined) return db;
  const file = process.env.MAIGUARD_DB;
  if (!file) return (db = null);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const handle = new DatabaseSync(file);
    handle.exec("PRAGMA journal_mode = WAL");
    for (const table of TABLES) handle.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    console.log(`[db] SQLite at ${file}`);
    return (db = handle);
  } catch (err) {
    console.error(`[db] could not open ${file}: ${(err as Error).message}; continuing in memory`);
    return (db = null);
  }
}

export const dbEnabled = () => Boolean(open());

const readTable = <T>(handle: DatabaseSync, table: Table): T[] =>
  (handle.prepare(`SELECT data FROM ${table}`).all() as { data: string }[]).map((row) => JSON.parse(row.data) as T);

/** Everything saved earlier, or undefined when there is no database or it is empty. */
export function load(): Snapshot | undefined {
  const handle = open();
  if (!handle) return undefined;
  try {
    const snapshot: Snapshot = {
      alerts: readTable<Alert>(handle, "alerts"),
      subscribers: readTable<Subscriber>(handle, "subscribers"),
      deliveries: readTable<Delivery>(handle, "deliveries"),
      checks: readTable<Check>(handle, "checks"),
      followUps: readTable<FollowUp>(handle, "follow_ups"),
    };
    if (snapshot.subscribers.length === 0 && snapshot.alerts.length === 0) {
      const imported = importLegacyFile();
      if (imported) return { ...snapshot, subscribers: imported };
      return undefined;
    }
    return snapshot;
  } catch (err) {
    console.error(`[db] could not read: ${(err as Error).message}`);
    return undefined;
  }
}

/** Earlier versions saved members to subscribers.json; carry those over once. */
function importLegacyFile(): Subscriber[] | undefined {
  const legacy = path.join(path.dirname(process.env.MAIGUARD_DB!), "subscribers.json");
  if (!fs.existsSync(legacy)) return undefined;
  try {
    const subscribers = JSON.parse(fs.readFileSync(legacy, "utf8")) as Subscriber[];
    console.log(`[db] imported ${subscribers.length} members from subscribers.json`);
    fs.renameSync(legacy, `${legacy}.imported`);
    return subscribers;
  } catch (err) {
    console.error(`[db] could not import subscribers.json: ${(err as Error).message}`);
    return undefined;
  }
}

/** Mirror the current state. Small data, so each save rewrites the tables in one transaction. */
export function save(snapshot: Snapshot) {
  const handle = open();
  if (!handle) return;
  const rows: [Table, { id: string }[]][] = [
    ["alerts", snapshot.alerts],
    ["subscribers", snapshot.subscribers],
    ["deliveries", snapshot.deliveries],
    ["checks", snapshot.checks],
    ["follow_ups", snapshot.followUps],
  ];
  try {
    handle.exec("BEGIN");
    for (const [table, records] of rows) {
      handle.exec(`DELETE FROM ${table}`);
      const insert = handle.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`);
      for (const record of records) insert.run(record.id, JSON.stringify(record));
    }
    handle.exec("COMMIT");
  } catch (err) {
    try {
      handle.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    console.error(`[db] could not save: ${(err as Error).message}`);
  }
}

/** Test hook: close and forget the handle so a new MAIGUARD_DB takes effect. */
export function closeDb() {
  if (db) db.close();
  db = undefined;
}
