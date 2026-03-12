"use client"

/**
 * Registers a global callback used by dynamic imports to request iframe reload.
 */
export function setExerciseServiceReloadBridge(port: MessagePort): () => void {
  const anyWindow = window as typeof window & {
    __exerciseServiceRequestReload?: () => void
  }

  anyWindow.__exerciseServiceRequestReload = () => {
    port.postMessage({
      message: "request-iframe-reload",
    })
  }

  return () => {
    if (anyWindow.__exerciseServiceRequestReload) {
      delete anyWindow.__exerciseServiceRequestReload
    }
  }
}
