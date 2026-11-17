import { atom } from "jotai"

export const blockIntersectionObserverAtom = atom<IntersectionObserver | null>(null)

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
) => {
  // Your API mutation here
}

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

  const flushStatuses = async () => {
    activeBlocks.forEach((_value, clientId) => {
      updateTime(clientId)
    })

    for (const [pageId, statuses] of viewStatuses) {
      await SendBlockStatuses(pageId, statuses)
      viewStatuses.delete(pageId)
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      visibleBlocks.forEach((id) => updateTime(id, true))
      void flushStatuses()
    } else {
      visibleBlocks.forEach((id) => {
        const element = document.querySelector(`#${id}`)
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

  setAtom(observer)

  return () => {
    activeBlocks.forEach((_value, clientId) => {
      updateTime(clientId, true)
    })

    flushStatuses()

    observer.disconnect()
    window.clearInterval(interval)

    document.removeEventListener("visibilitychange", handleVisibilityChange)

    setAtom(null)
  }
}
