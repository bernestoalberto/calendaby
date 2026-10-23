import type { SqlDriver, SqlValue } from './driver'

type Reply = { id: number; result?: unknown; error?: string }

export class WebSqlDriver implements SqlDriver {
  private readonly worker: Worker
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private nextId = 0
  persistent = false

  private constructor() {
    this.worker = new Worker(new URL('./web-worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<Reply>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      this.pending.delete(e.data.id)
      if (e.data.error) p.reject(new Error(e.data.error))
      else p.resolve(e.data.result)
    }
  }

  static async open(): Promise<WebSqlDriver> {
    const driver = new WebSqlDriver()
    driver.persistent = (await driver.send({ hello: true })) as boolean
    return driver
  }

  private send(body: object): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, ...body })
    })
  }

  async exec(sql: string, params: SqlValue[] = []): Promise<void> {
    await this.send({ sql, params, rows: false })
  }

  async query<T extends Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return (await this.send({ sql, params, rows: true })) as T[]
  }
}
