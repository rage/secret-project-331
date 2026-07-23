import { useCallback, useEffect, useRef } from "react"

import {
  FileUploadError,
  ParentUploadClient,
} from "@/shared-module/exercise-client/client/parentUpload"

/**
 * React hook for exercise services running inside the iframe: wraps a {@link ParentUploadClient} for
 * the given `MessagePort` and returns a stable `uploadFiles` function that asks the parent window to
 * upload files and resolves with a `Map` of name -> stored URL. Plugins never store files
 * themselves; the host does, then hands back the URLs, which the exercise records in its `answer`.
 *
 * `port` is the port handed to the exercise by `useExerciseServiceParentConnection`. While it is
 * `null` (parent not yet connected) `uploadFiles` rejects with a {@link FileUploadError}.
 */
export default function useFileUpload(
  port: MessagePort | null,
): (files: Map<string, string | Blob>) => Promise<Map<string, string>> {
  const clientRef = useRef<ParentUploadClient | null>(null)

  useEffect(() => {
    if (!port) {
      return
    }
    const client = new ParentUploadClient(port)
    clientRef.current = client
    return () => {
      client.dispose()
      if (clientRef.current === client) {
        clientRef.current = null
      }
    }
  }, [port])

  return useCallback((files: Map<string, string | Blob>): Promise<Map<string, string>> => {
    if (!clientRef.current) {
      return Promise.reject(new FileUploadError("Not connected to the parent window yet"))
    }
    return clientRef.current.uploadFiles(files)
  }, [])
}
