import { useCallback, useEffect, useRef } from "react"

import { OpenDialogOptions, ParentDialogClient } from "../exercise-service-protocol/parentDialog"

/**
 * React hook for exercise services running inside the iframe: wraps a {@link ParentDialogClient} for
 * the given `MessagePort` and returns a stable `openDialog` function that asks the parent window to
 * show a dialog and resolves with the user's choice.
 *
 * `port` is the port handed to the exercise by `useExerciseServiceParentConnection`. While it is
 * `null` (parent not yet connected) `openDialog` resolves to `false`.
 */
export default function useParentDialog(
  port: MessagePort | null,
): (options: OpenDialogOptions) => Promise<boolean> {
  const clientRef = useRef<ParentDialogClient | null>(null)

  useEffect(() => {
    if (!port) {
      return
    }
    const client = new ParentDialogClient(port)
    clientRef.current = client
    return () => {
      client.dispose()
      if (clientRef.current === client) {
        clientRef.current = null
      }
    }
  }, [port])

  return useCallback((options: OpenDialogOptions): Promise<boolean> => {
    if (!clientRef.current) {
      return Promise.resolve(false)
    }
    return clientRef.current.openDialog(options)
  }, [])
}
