import { Capacitor } from '@capacitor/core'
import type { SqlDriver } from './driver'

let opened: Promise<SqlDriver> | undefined

export function openDriver(): Promise<SqlDriver> {
  return (opened ??= Capacitor.isNativePlatform()
    ? import('./native').then(({ NativeSqlDriver }) => NativeSqlDriver.open())
    : import('./web').then(({ WebSqlDriver }) => WebSqlDriver.open()))
}
