import { useCallback, useEffect, useMemo, useRef } from "react"

import { pythonWorkerUrl } from "@/util/pyodideConfig"
import { stdinServiceWorker } from "@/util/stdinServiceWorker"

interface LoadingWorker {
  /** Settles once Pyodide has loaded in the worker, or failed to. */
  ready: Promise<Worker>
  terminate: () => void
}

function whenLoaded(worker: Worker): Promise<Worker> {
  return new Promise<Worker>((resolve, reject) => {
    const onMessage = (event: MessageEvent<{ type?: string; message?: string }>) => {
      if (event.data.type === "ready") {
        cleanup()
        resolve(worker)
      } else if (event.data.type === "load_error") {
        cleanup()
        reject(new Error(event.data.message ?? "Loading Python failed"))
      }
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      reject(new Error(event.message || "Loading Python failed"))
    }
    const cleanup = () => {
      worker.removeEventListener("message", onMessage)
      worker.removeEventListener("error", onError)
    }
    worker.addEventListener("message", onMessage)
    worker.addEventListener("error", onError)
  })
}

function startWorker(): LoadingWorker {
  let worker: Worker | null = null
  let terminated = false
  // The worker must start after the stdin service worker controls the page, or it is not
  // controlled and input() cannot block on it.
  const ready = stdinServiceWorker().then(() => {
    if (terminated) {
      throw new Error("The Python worker was stopped while starting")
    }
    worker = new Worker(pythonWorkerUrl(), { type: "module" })
    return whenLoaded(worker)
  })
  return {
    ready,
    terminate: () => {
      terminated = true
      worker?.terminate()
    },
  }
}

/**
 * One Pyodide worker shared by Run and Test, so Python loads once per editor.
 *
 * `acquire` resolves with the worker once Pyodide has loaded, starting it on first use. `discard`
 * terminates it, for a Stop or a timed-out test; the next `acquire` starts a fresh one. Run and Test
 * must not use the worker at the same time.
 */
export function usePythonWorker() {
  const currentRef = useRef<LoadingWorker | null>(null)

  const discard = useCallback(() => {
    currentRef.current?.terminate()
    currentRef.current = null
  }, [])

  const acquire = useCallback((): Promise<Worker> => {
    let current = currentRef.current
    if (current === null) {
      current = startWorker()
      currentRef.current = current
      const started = current
      started.ready.catch(() => {
        if (currentRef.current === started) {
          discard()
        }
      })
    }
    return current.ready
  }, [discard])

  useEffect(() => discard, [discard])

  return useMemo(() => ({ acquire, discard }), [acquire, discard])
}

export type PythonWorker = ReturnType<typeof usePythonWorker>
