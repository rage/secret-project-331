import { useCallback, useEffect, useRef } from "react"

import {
  FileUploadError,
  ParentUploadClient,
  type UploadedFile,
} from "@/shared-module/exercise-client/client/parentUpload"

/**
 * React hook for exercise services running inside the iframe: wraps a {@link ParentUploadClient} for
 * the given `MessagePort` and returns a stable `uploadFiles` function that asks the parent window to
 * upload files and resolves with host-assigned ids and stored URLs. Plugins never store files
 * themselves; the host does, then hands back the ids and URLs, which the exercise records in its `answer`.
 *
 * `port` is the port handed to the exercise by `useExerciseServiceParentConnection`. While it is
 * `null` (parent not yet connected) `uploadFiles` rejects with a {@link FileUploadError}.
 */
export default function useFileUpload(
  port: MessagePort | null,
): (files: readonly File[]) => Promise<UploadedFile[]> {
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

  return useCallback((files: readonly File[]): Promise<UploadedFile[]> => {
    if (!clientRef.current) {
      return Promise.reject(new FileUploadError("Not connected to the parent window yet"))
    }
    return clientRef.current.uploadFiles(files)
  }, [])
}
