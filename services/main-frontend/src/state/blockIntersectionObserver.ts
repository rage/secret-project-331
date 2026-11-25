import { atom } from "jotai"

import { updateBlockStatus } from "@/generated/api/sdk.generated"
import { sendWithBeacon } from "@/shared-module/common/utils/sendWithBeacon"

interface ActiveBlock {
  pageId: string
  startedAt: number
}

interface BlockViewStatus {
  read_units: number
  last_seen: string
}

export const SendBlockStatuses = async (
  pageId: string,
  statuses: Record<string, BlockViewStatus>,
  keepalive = false,
) => {
  return await updateBlockStatus({
    path: {
      page_id: pageId,
    },
    body: {
      block_statuses: statuses,
    },
    keepalive,
  })
}

interface BlockTracker {
  observer: IntersectionObserver
  unregister: (clientId: string) => void
}

export const blockIntersectionObserverAtom = atom<BlockTracker | null>(null)

blockIntersectionObserverAtom.onMount = (setAtom) => {
  const visibleBlocks = new Set<string>()
  const activeBlocks = new Map<string, ActiveBlock>()
  const viewStatuses = new Map<string, Record<string, BlockViewStatus>>()

  const startTime = (clientId: string, pageId: string) => {
    if (activeBlocks.has(clientId)) {
      return
    }

    activeBlocks.set(clientId, {
      pageId,
      startedAt: performance.now(),
    })
  }

  const updateTime = (clientId: string, stop = false) => {
    const active = activeBlocks.get(clientId)
    if (!active) {
      return
    }

    const now = performance.now()
    const timestamp = new Date().toISOString()

    const pageStatuses = viewStatuses.get(active.pageId) ?? {}

    const status = (pageStatuses[clientId] ??= {
      read_units: 0,
      last_seen: timestamp,
    })

    status.read_units += (now - active.startedAt) / 1000
    status.last_seen = timestamp

    viewStatuses.set(active.pageId, pageStatuses)

    if (stop) {
      activeBlocks.delete(clientId)
    } else {
      active.startedAt = now
    }
  }

  const unregister = (clientId: string) => {
    visibleBlocks.delete(clientId)
    updateTime(clientId, true)
  }

  const requeueStatuses = (pageId: string, statuses: Record<string, BlockViewStatus>) => {
    const pending = viewStatuses.get(pageId) ?? {}
    for (const [clientId, status] of Object.entries(statuses)) {
      const existing = pending[clientId]
      if (existing) {
        existing.read_units += status.read_units
        existing.last_seen =
          status.last_seen > existing.last_seen ? status.last_seen : existing.last_seen
      } else {
        pending[clientId] = status
      }
    }
    viewStatuses.set(pageId, pending)
  }

  const flushStatuses = async () => {
    activeBlocks.forEach((_value, clientId) => {
      updateTime(clientId)
    })

    for (const pageId of viewStatuses.keys()) {
      const statuses = viewStatuses.get(pageId)
      if (!statuses) {
        continue
      }
      viewStatuses.delete(pageId)

      try {
        await SendBlockStatuses(pageId, statuses)
      } catch (error) {
        requeueStatuses(pageId, statuses)
        throw error
      }
    }
  }

  const flushOnPageExit = () => {
    activeBlocks.forEach((_value, clientId) => {
      updateTime(clientId, true)
    })

    for (const pageId of viewStatuses.keys()) {
      const statuses = viewStatuses.get(pageId)
      if (!statuses) {
        continue
      }

      viewStatuses.delete(pageId)

      const body = JSON.stringify({
        block_statuses: statuses,
      })
      const url = `/api/v0/main-frontend/pages/${pageId}/update-block-status`
      const sent = sendWithBeacon(url, body)

      if (sent) {
        continue
      }

      SendBlockStatuses(pageId, statuses, true).catch(() => {
        requeueStatuses(pageId, statuses)
      })
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      visibleBlocks.forEach((id) => updateTime(id, true))
      flushStatuses()
    } else {
      visibleBlocks.forEach((id) => {
        // oxlint-disable-next-line unicorn/prefer-query-selector -- id is a raw UUID; querySelector("#"+id) may throw, getElementById is safe
        const element = document.getElementById(id)
        const pageId = element?.getAttribute("data-page-id")

        if (pageId) {
          startTime(id, pageId)
        }
      })
    }
  }

  const intersectionCallback: IntersectionObserverCallback = (entries) => {
    entries.forEach((entry) => {
      const element = entry.target
      const clientId = element.id

      if (entry.isIntersecting && !document.hidden) {
        const pageId = element.getAttribute("data-page-id")
        if (!pageId) {
          return
        }

        visibleBlocks.add(clientId)
        startTime(clientId, pageId)
      } else {
        visibleBlocks.delete(clientId)
        updateTime(clientId, true)
      }
    })
  }

  const observer = new IntersectionObserver(intersectionCallback, {
    root: null,
    rootMargin: "0px",
    threshold: 0.5,
  })

  const interval = window.setInterval(() => {
    flushStatuses()
  }, 60_000)

  document.addEventListener("visibilitychange", handleVisibilityChange)
  window.addEventListener("pagehide", flushOnPageExit)

  setAtom({ observer, unregister })

  return () => {
    activeBlocks.forEach((_value, clientId) => {
      updateTime(clientId, true)
    })

    flushStatuses()

    observer.disconnect()
    window.clearInterval(interval)

    document.removeEventListener("visibilitychange", handleVisibilityChange)
    window.removeEventListener("pagehide", flushOnPageExit)

    setAtom(null)
  }
}
