"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { ExerciseDialogApi } from "./exerciseDialogApi"
import {
  openUrlInNewTab,
  parseSafeHttpUrl,
  sanitizeDownloadFilename,
  startFileDownload,
} from "./parentLinkActions"
import useEventCallback from "./useEventCallback"

/**
 * Handlers for the iframe's `open-link` and `download-file` requests. An exercise can't open a tab or
 * start a download itself — its iframe is sandboxed without `allow-popups`, and a same-tab navigation
 * would replace the exercise — so it asks the parent, and the parent asks the user.
 *
 * The confirmation wording is the host's, not the plugin's: an exercise that could word its own
 * security prompt could talk the user into anything. Opening a link shows the full URL, since the
 * browser is about to navigate there. A download names only the origin: the rest of a file URL is
 * often a one-time access token, unreadable and unverifiable, so showing it made the prompt scarier
 * without making it safer.
 */
export interface IframeLinkRequests {
  /** Confirm, then open the requested URL in a new tab. */
  openLinkOnRequest: (rawUrl: unknown) => void
  /** Confirm, then download the requested file. */
  downloadFileOnRequest: (rawUrl: unknown, rawFilename: unknown) => void
}

const bodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const paragraphStyles = css`
  margin: 0;
`

const urlStyles = css`
  margin: 0;
  font-family: monospace;
  overflow-wrap: anywhere;
`

const RequestBody: React.FC<{
  explanation: string
  url?: string | undefined
  caution?: string | undefined
}> = ({ explanation, url, caution }) => (
  <div className={bodyStyles}>
    <p className={paragraphStyles}>{explanation}</p>
    {url !== undefined && <p className={urlStyles}>{url}</p>}
    {caution !== undefined && <p className={paragraphStyles}>{caution}</p>}
  </div>
)

export default function useIframeLinkRequests(
  dialog: ExerciseDialogApi,
  /** See `MessageChannelIFrame`'s prop of the same name. */
  overrideDownloadFilename?: (url: string) => string,
): IframeLinkRequests {
  const { t } = useTranslation()

  const confirmRequest = useEventCallback(
    (request: {
      title: string
      explanation: string
      confirmButtonLabel: string
      url?: string
      caution?: string
    }): Promise<boolean> =>
      dialog.confirm(
        <RequestBody
          explanation={request.explanation}
          url={request.url}
          caution={request.caution}
        />,
        request.title,
        { yesButtonLabel: request.confirmButtonLabel, noButtonLabel: t("button-cancel") },
      ),
  )

  const openLinkOnRequest = useEventCallback((rawUrl: unknown) => {
    const url = parseSafeHttpUrl(rawUrl)
    if (!url) {
      console.warn("[MessageChannelIFrame] Refusing to open a link that is not an http(s) URL", {
        url: rawUrl,
      })
      return
    }
    void confirmRequest({
      url: url.href,
      caution: t("only-continue-if-you-recognize-the-address"),
      title: t("exercise-wants-to-open-a-link-title"),
      explanation: t("exercise-wants-to-open-a-link-explanation"),
      confirmButtonLabel: t("open-link-confirm-button"),
    }).then((confirmed) => {
      if (!confirmed) {
        return
      }
      // The user just clicked the confirm button, so the popup blocker sees a real user gesture. It
      // can still refuse (e.g. a blanket block for the site), and a link that quietly does nothing
      // reads as broken, so say what happened.
      if (!openUrlInNewTab(url.href)) {
        void dialog.alert(
          t("opening-the-link-was-blocked-explanation"),
          t("opening-the-link-was-blocked-title"),
        )
      }
    })
  })

  const downloadFileOnRequest = useEventCallback((rawUrl: unknown, rawFilename: unknown) => {
    const url = parseSafeHttpUrl(rawUrl)
    if (!url) {
      console.warn("[MessageChannelIFrame] Refusing to download a URL that is not http(s)", {
        url: rawUrl,
      })
      return
    }
    const filename = sanitizeDownloadFilename(
      overrideDownloadFilename ? overrideDownloadFilename(url.href) : rawFilename,
    )
    void confirmRequest({
      title: t("exercise-wants-to-download-a-file-title"),
      explanation:
        filename === null
          ? t("exercise-wants-to-download-a-file-explanation", { origin: url.origin })
          : t("exercise-wants-to-download-a-named-file-explanation", {
              filename,
              origin: url.origin,
            }),
      confirmButtonLabel: t("download-file-confirm-button"),
    }).then((confirmed) => {
      if (confirmed) {
        void startFileDownload(url.href, filename)
      }
    })
  })

  return { openLinkOnRequest, downloadFileOnRequest }
}
