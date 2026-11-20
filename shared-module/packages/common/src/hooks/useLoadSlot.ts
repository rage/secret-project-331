"use client"

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react"

import { useInView } from "./useInView"

export interface LoadSlotConfig {
  /** Concurrent loads; participants near the viewport may exceed it by one. */
  capacity: number
  /** A granted slot is released after this long even if the participant never reports done. */
  maxHoldMs: number
}

/**
 * `waiting`: not started, no slot yet. `holding`: started and holding a slot. `released`: started,
 * slot freed (done, failed or held for `maxHoldMs`).
 */
export type LoadSlotStatus = "waiting" | "holding" | "released"

export const DEFAULT_LOAD_SLOT_CONFIG: LoadSlotConfig = { capacity: 3, maxHoldMs: 8000 }

/** Roughly one screen above and below, so what the student is about to see loads first. */
export const NEAR_VIEWPORT_ROOT_MARGIN = "100% 0px"

const IDLE_TIMEOUT_MS = 2000
const IDLE_FALLBACK_DELAY_MS = 200

interface Participant {
  id: string
  element: Element | null
  registrationIndex: number
  isNearViewport: boolean
  status: LoadSlotStatus
  holdTimer: ReturnType<typeof setTimeout> | null
}

/** Grants a limited number of concurrent load slots: near-viewport participants first, then the rest in document order during idle time. */
export interface LoadSlotScheduler {
  /** Adds a waiting participant. Registering an id twice keeps the existing participant. */
  register: (id: string, element: Element | null) => void
  /** Removes the participant, freeing its slot. */
  unregister: (id: string) => void
  setNearViewport: (id: string, isNearViewport: boolean) => void
  /** Frees the participant's slot; no-op unless it is holding one. */
  release: (id: string) => void
  getStatus: (id: string) => LoadSlotStatus | undefined
  configure: (config: Partial<LoadSlotConfig>) => void
  subscribe: (listener: () => void) => () => void
}

function requestIdle(callback: () => void): void {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS })
    return
  }
  // Safari has no requestIdleCallback.
  setTimeout(callback, IDLE_FALLBACK_DELAY_MS)
}

function compareDocumentOrder(a: Participant, b: Participant): number {
  if (a.element && b.element && a.element !== b.element) {
    const position = a.element.compareDocumentPosition(b.element)
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1
    }
    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1
    }
  }
  return a.registrationIndex - b.registrationIndex
}

/** A standalone scheduler; components share one per queue through `getLoadSlotScheduler`. */
export function createLoadSlotScheduler(config: Partial<LoadSlotConfig> = {}): LoadSlotScheduler {
  let { capacity, maxHoldMs } = { ...DEFAULT_LOAD_SLOT_CONFIG, ...config }
  const participants = new Map<string, Participant>()
  const listeners = new Set<() => void>()
  let nextRegistrationIndex = 0
  let isIdleFillRequested = false

  const notify = () => listeners.forEach((listener) => listener())

  const countHolding = () =>
    [...participants.values()].filter((participant) => participant.status === "holding").length

  const waitingInDocumentOrder = () =>
    [...participants.values()]
      .filter((participant) => participant.status === "waiting")
      .toSorted(compareDocumentOrder)

  const isNearViewportBusy = () =>
    [...participants.values()].some(
      (participant) => participant.isNearViewport && participant.status !== "released",
    )

  const grant = (participant: Participant) => {
    participant.status = "holding"
    participant.holdTimer = setTimeout(() => release(participant.id), maxHoldMs)
  }

  const fillInBackground = () => {
    isIdleFillRequested = false
    if (isNearViewportBusy()) {
      return
    }
    let holdingCount = countHolding()
    let hasGranted = false
    for (const participant of waitingInDocumentOrder()) {
      if (holdingCount >= capacity) {
        break
      }
      grant(participant)
      holdingCount++
      hasGranted = true
    }
    if (hasGranted) {
      notify()
    }
  }

  const schedule = () => {
    let holdingCount = countHolding()
    let hasGranted = false
    for (const participant of waitingInDocumentOrder()) {
      if (holdingCount >= capacity + 1) {
        break
      }
      if (participant.isNearViewport) {
        grant(participant)
        holdingCount++
        hasGranted = true
      }
    }
    if (hasGranted) {
      notify()
    }
    const hasWaiting = [...participants.values()].some((p) => p.status === "waiting")
    if (hasWaiting && !isIdleFillRequested && holdingCount < capacity && !isNearViewportBusy()) {
      isIdleFillRequested = true
      requestIdle(fillInBackground)
    }
  }

  const release = (id: string) => {
    const participant = participants.get(id)
    if (!participant || participant.status !== "holding") {
      return
    }
    if (participant.holdTimer) {
      clearTimeout(participant.holdTimer)
      participant.holdTimer = null
    }
    participant.status = "released"
    notify()
    schedule()
  }

  return {
    register: (id, element) => {
      if (participants.has(id)) {
        return
      }
      participants.set(id, {
        id,
        element,
        registrationIndex: nextRegistrationIndex++,
        isNearViewport: false,
        status: "waiting",
        holdTimer: null,
      })
      notify()
      schedule()
    },
    unregister: (id) => {
      const participant = participants.get(id)
      if (!participant) {
        return
      }
      if (participant.holdTimer) {
        clearTimeout(participant.holdTimer)
      }
      participants.delete(id)
      notify()
      schedule()
    },
    setNearViewport: (id, isNearViewport) => {
      const participant = participants.get(id)
      if (!participant || participant.isNearViewport === isNearViewport) {
        return
      }
      participant.isNearViewport = isNearViewport
      schedule()
    },
    release,
    getStatus: (id) => participants.get(id)?.status,
    configure: (next) => {
      capacity = next.capacity ?? capacity
      maxHoldMs = next.maxHoldMs ?? maxHoldMs
      schedule()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const schedulersByQueueId = new Map<string, LoadSlotScheduler>()

/** The page-wide scheduler shared by every participant using `qid`. */
export function getLoadSlotScheduler(qid: string): LoadSlotScheduler {
  let scheduler = schedulersByQueueId.get(qid)
  if (!scheduler) {
    scheduler = createLoadSlotScheduler()
    schedulersByQueueId.set(qid, scheduler)
  }
  return scheduler
}

export interface LoadSlot {
  /** Attach to the participant's outermost element; used for viewport and document order. */
  ref: (node: Element | null) => void
  status: LoadSlotStatus
  /** Call when the load has finished or failed. */
  release: () => void
}

/**
 * Joins the `qid` queue for the component's lifetime. Start loading once `status` leaves
 * `waiting`, and call `release` when done; unmounting also frees the slot.
 */
export function useLoadSlot(
  qid: string,
  config?: Partial<LoadSlotConfig>,
  rootMargin: string = NEAR_VIEWPORT_ROOT_MARGIN,
): LoadSlot {
  const participantId = useId()
  const scheduler = getLoadSlotScheduler(qid)
  const elementRef = useRef<Element | null>(null)
  const [inViewRef, isNearViewport] = useInView({ rootMargin })

  const ref = useCallback(
    (node: Element | null) => {
      elementRef.current = node
      inViewRef(node)
    },
    [inViewRef],
  )

  const capacity = config?.capacity
  const maxHoldMs = config?.maxHoldMs
  useEffect(() => {
    scheduler.configure({
      ...(capacity !== undefined && { capacity }),
      ...(maxHoldMs !== undefined && { maxHoldMs }),
    })
  }, [scheduler, capacity, maxHoldMs])

  useEffect(() => {
    scheduler.register(participantId, elementRef.current)
    return () => scheduler.unregister(participantId)
  }, [scheduler, participantId])

  useEffect(() => {
    scheduler.setNearViewport(participantId, isNearViewport)
  }, [scheduler, participantId, isNearViewport])

  const status = useSyncExternalStore(
    scheduler.subscribe,
    () => scheduler.getStatus(participantId) ?? "waiting",
    () => "waiting" as const,
  )

  const release = useCallback(() => scheduler.release(participantId), [scheduler, participantId])

  return { ref, status, release }
}
