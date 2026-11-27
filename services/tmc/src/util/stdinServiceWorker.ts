import basePath from "@/lib/basePath"

/** How long a first visit waits for the freshly registered service worker to take control. */
const CONTROL_TIMEOUT_MS = 5000

let activeWorker: Promise<ServiceWorker | null> | null = null

function waitForControl(container: ServiceWorkerContainer): Promise<void> {
  if (container.controller !== null) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The service worker did not take control")),
      CONTROL_TIMEOUT_MS,
    )
    container.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

async function register(): Promise<ServiceWorker | null> {
  const container = navigator.serviceWorker as ServiceWorkerContainer | undefined
  if (container === undefined) {
    return null
  }
  try {
    await container.register(`${basePath()}/stdinServiceWorker.js`, {
      scope: `${basePath()}/`,
      updateViaCache: "none",
    })
    const registration = await container.ready
    await waitForControl(container)
    return registration.active
  } catch (error) {
    console.warn("Blocking input() is unavailable without the stdin service worker", error)
    return null
  }
}

/**
 * Registers public/stdinServiceWorker.js and waits until it controls this page, so that Python
 * workers started afterwards are controlled too and `input()` can block on it. Resolves with the
 * active service worker, or null where service workers are unavailable (for example in a private
 * window); Python then falls back to another way of reading input.
 */
export function stdinServiceWorker(): Promise<ServiceWorker | null> {
  activeWorker ??= register()
  return activeWorker
}

/** Answers the Python worker's blocking `input()` call `id`. */
export async function postStdinLine(id: string, line: string): Promise<void> {
  const registered = await stdinServiceWorker()
  // The controller at send time: it may have taken control after registration timed out, or
  // replaced the registered worker after an update.
  const worker =
    (navigator.serviceWorker as ServiceWorkerContainer | undefined)?.controller ?? registered
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin
  worker?.postMessage({ type: "stdin_line", id, line })
}
