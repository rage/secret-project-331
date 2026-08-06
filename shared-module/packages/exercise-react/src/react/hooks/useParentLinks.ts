import { useMemo } from "react"

import type { FileDownloadRequest } from "@/shared-module/exercise-client/client/parentLinks"
import {
  LinkRequestError,
  requestFileDownload,
  requestOpenLink,
} from "@/shared-module/exercise-client/client/parentLinks"

export interface ParentLinks {
  /** Ask the parent to open `url` in a new tab, once the user confirms. */
  openLink: (url: string) => void
  /** Ask the parent to download a file for the user, once they confirm. */
  downloadFile: (request: FileDownloadRequest) => void
}

/**
 * React hook for exercise services running inside the iframe: returns the two "please do this in the
 * top-level page" requests an exercise cannot perform itself, because its iframe is sandboxed without
 * `allow-popups` and navigating inside it would replace the exercise. The parent asks the user to
 * confirm — showing the URL — before opening or downloading anything.
 *
 * Both requests are fire-and-forget: the parent never reports back what the user chose, so render the
 * link or download control as a plain action and don't put any UI into a pending state waiting for it.
 *
 * `port` is the port handed to the exercise by `useExerciseServiceParentConnection`. While it is
 * `null` (parent not yet connected) both functions throw a {@link LinkRequestError}, as does a URL
 * the parent would refuse anyway (anything but an absolute http(s) URL).
 */
export default function useParentLinks(port: MessagePort | null): ParentLinks {
  return useMemo(
    () => ({
      openLink: (url: string) => {
        if (!port) {
          throw new LinkRequestError("Not connected to the parent window yet")
        }
        requestOpenLink(port, url)
      },
      downloadFile: (request: FileDownloadRequest) => {
        if (!port) {
          throw new LinkRequestError("Not connected to the parent window yet")
        }
        requestFileDownload(port, request)
      },
    }),
    [port],
  )
}
