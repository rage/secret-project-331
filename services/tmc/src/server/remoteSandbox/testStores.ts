import { randomUUID } from "node:crypto"

import { Redis } from "ioredis"

import type { RemoteGradingStore } from "./gradingStore"
import { MemoryRemoteGradingStore } from "./gradingStore"
import { RedisRemoteGradingStore } from "./redisGradingStore"

/** Makes stores that share state, like the processes of one service. */
export interface StoreFactory {
  name: string
  /** A store over the same state as every other store from this factory until `reset`. */
  store: (now: () => number) => RemoteGradingStore
  reset: () => Promise<void>
  close: () => Promise<void>
}

/** The in-memory store, and the Redis store when `TMC_TEST_REDIS_URL` names a Redis to use. */
export function storeFactories(): StoreFactory[] {
  const factories: StoreFactory[] = [memoryFactory()]
  const redisUrl = process.env.TMC_TEST_REDIS_URL
  if (redisUrl) {
    factories.push(redisFactory(redisUrl))
  }
  return factories
}

function memoryFactory(): StoreFactory {
  let shared: MemoryRemoteGradingStore | null = null
  return {
    name: "memory",
    store: (now) => (shared ??= new MemoryRemoteGradingStore(now)),
    reset: () => {
      shared = null
      return Promise.resolve()
    },
    close: () => Promise.resolve(),
  }
}

function redisFactory(url: string): StoreFactory {
  const clients: Redis[] = []
  let prefix = newPrefix()
  return {
    name: "redis",
    store: () => {
      const client = new Redis(url, { maxRetriesPerRequest: 1 })
      clients.push(client)
      return new RedisRemoteGradingStore(client, prefix)
    },
    reset: async () => {
      const [client] = clients
      if (client) {
        await deleteKeys(client, prefix)
      }
      prefix = newPrefix()
    },
    close: async () => {
      await Promise.all(clients.map((client) => client.quit()))
    },
  }
}

function newPrefix(): string {
  return `tmc:remote-sandbox-test:${randomUUID()}:`
}

async function deleteKeys(client: Redis, prefix: string): Promise<void> {
  let cursor = "0"
  do {
    const [next, keys] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100)
    cursor = next
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } while (cursor !== "0")
}
