// Framework-agnostic iframe content-height tracking.
//
// This is the reusable substrate behind the React `HeightTrackingContainer`: it watches an
// element with a ResizeObserver, a window `resize` listener, and a periodic safety poll, and
// posts a `height-changed` message to the parent whenever the measured height changes. It
// depends only on DOM APIs (no React).

export interface HeightObserver {
  /** Set (or clear) the port height updates are posted to. Posts immediately if changed. */
  setPort: (port: MessagePort | null) => void
  /** Stop observing and clear all listeners/timers. Idempotent. */
  dispose: () => void
}

export interface HeightObserverOptions {
  /** The element whose height is tracked. */
  element: HTMLElement
  /** The port to post `height-changed` messages to. May be set later via `setPort`. */
  port?: MessagePort | null
  /** Called with every distinct measured height (used by the React shell to drive context). */
  onHeight?: (height: number) => void
  /** Safety poll interval in milliseconds. Defaults to 5000. */
  pollIntervalMs?: number
}

/**
 * Start observing `element`'s height. Begins observing immediately and takes an initial
 * measurement.
 */
export function observeHeight(options: HeightObserverOptions): HeightObserver {
  const { element, onHeight, pollIntervalMs = 5000 } = options
  let port: MessagePort | null = options.port ?? null
  let currentHeight = 0
  let previouslySentHeight = 0

  const measure = () => element.getBoundingClientRect().height

  const sendIfChanged = () => {
    if (!port || currentHeight === previouslySentHeight) {
      return
    }
    port.postMessage({
      message: "height-changed",
      data: currentHeight,
    })
    previouslySentHeight = currentHeight
  }

  const setHeight = (height: number) => {
    if (height === currentHeight) {
      return
    }
    currentHeight = height
    onHeight?.(height)
    sendIfChanged()
  }

  const onResize = () => {
    setHeight(measure())
  }

  window.addEventListener("resize", onResize)

  const observer = new ResizeObserver(onResize)
  observer.observe(element)

  // To be safe, we'll check periodically whether the sent height matches the actual height.
  const intervalId = setInterval(() => {
    if (!port) {
      return
    }
    const height = measure()
    if (height !== previouslySentHeight) {
      setHeight(height)
    }
  }, pollIntervalMs)

  // Initial measurement.
  setHeight(measure())

  return {
    setPort(newPort) {
      port = newPort
      sendIfChanged()
    },
    dispose() {
      window.removeEventListener("resize", onResize)
      observer.disconnect()
      clearInterval(intervalId)
    },
  }
}
