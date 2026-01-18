import { Context } from "hono";

export class Logger {
  private db: D1Database;
  private ctx?: Context;

  constructor(db: D1Database, ctx?: Context) {
    this.db = db;
    this.ctx = ctx;
  }

  private serialize(data: any): string {
    try {
      if (data === undefined || data === null) {
        return "{}";
      }
      if (data instanceof Error) {
        return JSON.stringify({ 
            name: data.name,
            message: data.message, 
            stack: data.stack,
            cause: data.cause 
        });
      }
      return JSON.stringify(data);
    } catch {
      return "{}";
    }
  }

  private async write(level: "INFO" | "WARN" | "ERROR", message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    
    const logOutput = `[${timestamp}] [${level}] ${message}`;
    
    switch (level) {
        case "INFO":
            console.info(logOutput, meta ?? "");
            break;
        case "WARN":
            console.warn(logOutput, meta ?? "");
            break;
        case "ERROR":
            console.error(logOutput, meta ?? "");
            break;
    }

    // CRITICAL FIX: Ensure meta is never undefined when binding to D1
    const serializedMeta = this.serialize(meta);
    const timestampMs = Date.now();

    const dbPromise = (async () => {
        try {
            await this.db.prepare(
                "INSERT INTO event_logs (level, message, meta, timestamp) VALUES (?, ?, ?, ?)"
            ).bind(level, message, serializedMeta, timestampMs).run();
        } catch (e) {
            console.error("CRITICAL: Failed to write log to D1", e);
        }
    })();

    if (this.ctx && this.ctx.executionCtx) {
        this.ctx.executionCtx.waitUntil(dbPromise);
    } else {
        await dbPromise;
    }
  }

  async info(message: string, meta?: any) {
    await this.write("INFO", message, meta);
  }

  async warn(message: string, meta?: any) {
    await this.write("WARN", message, meta);
  }

  async error(message: string, meta?: any) {
    await this.write("ERROR", message, meta);
  }
}