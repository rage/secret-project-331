import { atom, useAtomValue, useSetAtom } from "jotai"
import { atomFamily } from "jotai/utils"
import * as React from "react"
import { useCallback, useEffect, useMemo } from "react"

export type ParticipantStatus = "waiting" | "active" | "demoted" | "left" | "done" | "canceled"

export interface Participant {
  id: string
  joinedAt: number
  activatedAt?: number
  status: ParticipantStatus
  timer?: ReturnType<typeof setTimeout> | null
}

export interface QueueConfig {
  capacity: number
  maxHoldMs: number
}

export interface QueueMetrics {
  capacity: number
  maxHoldMs: number
  size: number
  waiting: number
  active: number
  demoted: number
}

export interface ParticipantView {
  id: string
  status: ParticipantStatus | "unknown"
  waitingPosition: number
  isActive: boolean
}

export interface QueueAPI {
  join: (id?: string) => string
  leave: (id: string) => void
  done: (id: string) => void
  setCapacity: (n: number) => void
  setMaxHoldMs: (ms: number) => void
}

const capacityAtomFamily = atomFamily((_qid: string) => atom<number>(1))
const maxHoldMsAtomFamily = atomFamily((_qid: string) => atom<number>(10_000))
const participantsAtomFamily = atomFamily((_qid: string) => atom<Participant[]>([]))

const dispatchAtomFamily = atomFamily((qid: string) =>
  atom(null, (get, set) => {
    const capacity = get(capacityAtomFamily(qid))
    const maxHoldMs = get(maxHoldMsAtomFamily(qid))
    const list = get(participantsAtomFamily(qid))

    const activeCount = list.filter((p) => p.status === "active").length
    const need = Math.max(0, capacity - activeCount)
    if (need === 0) {
      return
    }

    const waiting = list.filter((p) => p.status === "waiting").slice(0, need)
    if (waiting.length === 0) {
      return
    }

    const now = Date.now()
    const promotedIds = new Set(waiting.map((w) => w.id))
    const timers: Record<string, ReturnType<typeof setTimeout> | null> = {}

    waiting.forEach((p) => {
      timers[p.id] =
        maxHoldMs > 0 ? setTimeout(() => set(demoteAtomFamily(qid), p.id), maxHoldMs) : null
    })

    set(
      participantsAtomFamily(qid),
      list.map((p) =>
        promotedIds.has(p.id)
          ? { ...p, status: "active", activatedAt: now, timer: timers[p.id] ?? null }
          : p,
      ),
    )
  }),
)

const demoteAtomFamily = atomFamily((qid: string) =>
  atom(null, (get, set, id: string) => {
    const list = get(participantsAtomFamily(qid))
    const existing = list.find((p) => p.id === id)
    if (!existing) {
      return
    }
    if (existing.timer) {
      clearTimeout(existing.timer)
    }
    if (existing.status !== "active") {
      return
    }

    set(
      participantsAtomFamily(qid),
      list.map((p) => (p.id === id ? { ...p, status: "demoted", timer: null } : p)),
    )
    set(dispatchAtomFamily(qid))
  }),
)

const joinAtomFamily = atomFamily((qid: string) =>
  atom(null, (get, set, id: string) => {
    const list = get(participantsAtomFamily(qid))
    if (list.some((p) => p.id === id)) {
      return
    }
    const now = Date.now()
    const next: Participant = { id, joinedAt: now, status: "waiting", timer: null }
    set(participantsAtomFamily(qid), [...list, next])
    set(dispatchAtomFamily(qid))
  }),
)

const leaveAtomFamily = atomFamily((qid: string) =>
  atom(null, (get, set, id: string) => {
    const list = get(participantsAtomFamily(qid))
    const target = list.find((p) => p.id === id)
    if (!target) {
      return
    }
    if (target.timer) {
      clearTimeout(target.timer)
    }

    const wasActive = target.status === "active"
    const filtered = list.filter((p) => p.id !== id)
    set(participantsAtomFamily(qid), filtered)
    if (wasActive) {
      set(dispatchAtomFamily(qid))
    }
  }),
)

const doneAtomFamily = atomFamily((qid: string) =>
  atom(null, (get, set, id: string) => {
    const list = get(participantsAtomFamily(qid))
    const target = list.find((p) => p.id === id)
    if (!target) {
      return
    }
    if (target.timer) {
      clearTimeout(target.timer)
    }
    const wasActive = target.status === "active"
    set(
      participantsAtomFamily(qid),
      list.filter((p) => p.id !== id),
    )
    if (wasActive) {
      set(dispatchAtomFamily(qid))
    }
  }),
)

// ---------- id generator ----------

const genId = (() => {
  let c = 0
  return () => `${Date.now().toString(36)}-${(c++).toString(36)}`
})()

/**
 * Throttles concurrent operations with a FIFO queue (scoped by `qid`).
 * Up to `capacity` participants run concurrently.
 * Participants exceeding `maxHoldMs` are demoted, freeing their slot for the next in queue.
 *
 * Returns only **non-hook** actions.
 */
export function useConcurrencyThrottle(qid: string, initial?: Partial<QueueConfig>): QueueAPI {
  const setCapacityAtom = useSetAtom(capacityAtomFamily(qid))
  const setMaxHoldAtom = useSetAtom(maxHoldMsAtomFamily(qid))
  const dispatch = useSetAtom(dispatchAtomFamily(qid))

  useEffect(() => {
    if (typeof initial?.capacity === "number") {
      setCapacityAtom(Math.max(0, Math.floor(initial.capacity)))
      dispatch()
    }
    if (typeof initial?.maxHoldMs === "number") {
      setMaxHoldAtom(initial.maxHoldMs)
      dispatch()
    }
  }, [qid, initial?.capacity, initial?.maxHoldMs, setCapacityAtom, setMaxHoldAtom, dispatch])

  const doJoin = useSetAtom(joinAtomFamily(qid))
  const doLeave = useSetAtom(leaveAtomFamily(qid))
  const doDone = useSetAtom(doneAtomFamily(qid))

  const join = useCallback(
    (id?: string) => {
      const finalId = id ?? genId()
      doJoin(finalId)
      return finalId
    },
    [doJoin],
  )

  const leave = useCallback((id: string) => doLeave(id), [doLeave])
  const done = useCallback((id: string) => doDone(id), [doDone])

  const setCapacity = useCallback(
    (n: number) => {
      setCapacityAtom(Math.max(0, Math.floor(n)))
      dispatch()
    },
    [setCapacityAtom, dispatch],
  )
  const setMaxHoldMs = useCallback(
    (ms: number) => {
      setMaxHoldAtom(ms)
      dispatch()
    },
    [setMaxHoldAtom, dispatch],
  )

  return useMemo(
    () => ({ join, leave, done, setCapacity, setMaxHoldMs }),
    [join, leave, done, setCapacity, setMaxHoldMs],
  )
}

/**
 * Read-only queue metrics hook (scoped by `qid`).
 */
export function useQueueMetrics(qid: string): QueueMetrics {
  const capacity = useAtomValue(capacityAtomFamily(qid))
  const maxHoldMs = useAtomValue(maxHoldMsAtomFamily(qid))
  const list = useAtomValue(participantsAtomFamily(qid))

  const active = list.filter((p) => p.status === "active").length
  const demoted = list.filter((p) => p.status === "demoted").length
  const waiting = list.filter((p) => p.status === "waiting").length

  return { capacity, maxHoldMs, size: list.length, waiting, active, demoted }
}

/**
 * Read-only participant view hook (scoped by `qid`).
 */
export function useParticipantView(qid: string, id: string | undefined): ParticipantView {
  const list = useAtomValue(participantsAtomFamily(qid))

  if (!id) {
    return { id: "", status: "unknown", waitingPosition: -1, isActive: false }
  }

  const p = list.find((x) => x.id === id)
  const waitingQueue = list.filter((x) => x.status === "waiting")
  const waitingPosition =
    p?.status === "waiting" ? waitingQueue.findIndex((x) => x.id === id) + 1 : 0

  return {
    id,
    status: p?.status ?? "unknown",
    waitingPosition,
    isActive: p?.status === "active",
  }
}

/**
 * Convenience hook for managing a single participant in the throttle queue (scoped by `qid`).
 */
export function useThrottledParticipant(qid: string, opts?: { autoJoin?: boolean; id?: string }) {
  const queue = useConcurrencyThrottle(qid)
  const [id, setId] = React.useState<string | undefined>(opts?.id)

  useEffect(() => {
    setId(undefined)
  }, [qid])

  useEffect(() => {
    if (opts?.autoJoin && !id) {
      setId(queue.join(opts?.id))
    }
  }, [qid, opts?.autoJoin, opts?.id, id, queue])

  useEffect(() => {
    return () => {
      if (id) {
        queue.leave(id)
      }
    }
  }, [qid, id, queue])

  const view = useParticipantView(qid, id)

  return {
    id,
    view,
    join: useCallback(() => {
      if (id) {
        return id
      }
      const newId = queue.join(opts?.id)
      setId(newId)
      return newId
    }, [id, queue, opts?.id]),
    leave: useCallback(() => {
      if (id) {
        queue.leave(id)
        setId(undefined)
      }
    }, [queue, id, setId]),
    done: useCallback(() => {
      if (id) {
        queue.done(id)
        setId(undefined)
      }
    }, [queue, id, setId]),
  } as const
}
