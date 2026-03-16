"use client"

import { css } from "@emotion/css"
import { isEqual } from "lodash"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  ExtendedIframeState,
  MessageFromIframe,
  SetLanguageMessage,
  SetStateMessage,
} from "../exercise-service-protocol-types"
import {
  isHeightChangedMessage,
  isMessageFromIframe,
  isOpenLinkMessage,
  isRequestIframeReloadMessage,
} from "../exercise-service-protocol-types.guard"
import useEventCallback from "../hooks/useEventCallback"
import useMessageChannel from "../hooks/useMessageChannel"

import { BreakFromCenteredProps } from "./Centering/BreakFromCentered"

interface MessageChannelIFrameProps {
  url: string
  postThisStateToIFrame: ExtendedIframeState | null
  onMessageFromIframe: (message: MessageFromIframe, responsePort: MessagePort) => void
  breakFromCenteredProps?: BreakFromCenteredProps
  title: string
  showBorders?: boolean
  disableSandbox?: boolean
  headingBeforeIframe?: string
  onReady?: () => void
}

const useIframeSandboxingAttribute = (disableSandbox: boolean) => {
  if (disableSandbox) {
    return undefined
  }
  // Allow same origin in development ONLY so that the Next.js dev overlay works. Note that exercise plugins should be tested with the host program in production mode.
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line i18next/no-literal-string
    return "allow-scripts allow-forms allow-downloads allow-same-origin"
  }
  // eslint-disable-next-line i18next/no-literal-string
  return "allow-scripts allow-forms allow-downloads"
}

const MessageChannelIFrame: React.FC<React.PropsWithChildren<MessageChannelIFrameProps>> = ({
  url,
  postThisStateToIFrame,
  onMessageFromIframe,
  headingBeforeIframe,
  title,
  showBorders = false,
  disableSandbox = false,
  onReady,
}) => {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeSandboxAttribute = useIframeSandboxingAttribute(disableSandbox)
  const hasSignaledReadyRef = useRef(false)
  const lastThingPostedRef = useRef<unknown>(null)

  const [reloadNonce, setReloadNonce] = useState(0)
  const [reloadExhausted, setReloadExhausted] = useState(false)

  const [messageChannel, recreateMessageChannel] = useMessageChannel()
  const portSentRef = useRef(false)
  const portSentTimestampRef = useRef<number | null>(null)
  const recoveryAttemptsRef = useRef(0)
  const readyMessageQueueRef = useRef<MessageEvent[]>([])
  const reloadAttemptsRef = useRef(0)
  const reloadTimeoutRef = useRef<number | null>(null)

  const MAX_RECOVERY_ATTEMPTS = 3
  const RECOVERY_TIMEOUT_MS = 5000
  const MAX_RELOAD_ATTEMPTS = 4
  const INITIAL_RELOAD_DELAY_MS = 250

  const resetIframeConnectionState = useCallback(
    ({
      recreateChannel = false,
      resetRecoveryAttempts = true,
    }: {
      recreateChannel?: boolean
      resetRecoveryAttempts?: boolean
    } = {}) => {
      portSentRef.current = false
      portSentTimestampRef.current = null
      hasSignaledReadyRef.current = false
      readyMessageQueueRef.current = []
      if (resetRecoveryAttempts) {
        recoveryAttemptsRef.current = 0
      }
      lastThingPostedRef.current = null
      if (recreateChannel) {
        recreateMessageChannel()
      }
    },
    [recreateMessageChannel],
  )

  useEffect(() => {
    const clearReloadTimeout = () => {
      if (reloadTimeoutRef.current !== null) {
        clearTimeout(reloadTimeoutRef.current)
        reloadTimeoutRef.current = null
      }
    }

    resetIframeConnectionState()
    reloadAttemptsRef.current = 0
    clearReloadTimeout()
    setReloadNonce(0)
    setReloadExhausted(false)

    return clearReloadTimeout
  }, [resetIframeConnectionState, url])

  const scheduleIframeReload = useCallback(() => {
    if (!iframeRef.current) {
      return
    }
    if (reloadTimeoutRef.current !== null) {
      console.info(
        "[MessageChannelIFrame] Ignoring duplicate iframe reload request while a reload is already scheduled",
      )
      return
    }
    if (reloadAttemptsRef.current >= MAX_RELOAD_ATTEMPTS) {
      console.error(
        `[MessageChannelIFrame] Max iframe reload attempts (${MAX_RELOAD_ATTEMPTS}) reached. Giving up.`,
      )
      setReloadExhausted(true)
      return
    }

    const attempt = reloadAttemptsRef.current + 1
    const delay = Math.min(INITIAL_RELOAD_DELAY_MS * 2 ** (attempt - 1), 2000)
    console.warn(
      `[MessageChannelIFrame] Scheduling iframe reload (attempt ${attempt}/${MAX_RELOAD_ATTEMPTS}) in ${delay}ms`,
    )

    reloadAttemptsRef.current = attempt
    reloadTimeoutRef.current = window.setTimeout(() => {
      reloadTimeoutRef.current = null
      resetIframeConnectionState({ recreateChannel: true })
      setReloadNonce((prev) => prev + 1)
    }, delay)
  }, [resetIframeConnectionState])

  const sendPortToIframe = useCallback((messageChannel: MessageChannel, isRecovery = false) => {
    if (portSentRef.current && !isRecovery) {
      return
    }

    if (!iframeRef.current) {
      return
    }

    const contentWindow = iframeRef.current.contentWindow
    if (!contentWindow) {
      return
    }

    // eslint-disable-next-line i18next/no-literal-string
    const recoveryMessage = isRecovery ? " (recovery attempt)" : ""
    console.info(`[MessageChannelIFrame] Parent posting message port to iframe${recoveryMessage}`)
    try {
      // The iframe will use port 2 for communication
      contentWindow.postMessage("communication-port", "*", [messageChannel.port2])
      portSentRef.current = true
      portSentTimestampRef.current = Date.now()
    } catch (e) {
      console.error("[MessageChannelIFrame] Posting communication port to iframe failed", e)
    }
  }, [])

  const handlePortMessage = useEventCallback(
    (message: WindowEventMap["message"], currentMessageChannel: MessageChannel) => {
      const data = message?.data
      if (data?.message) {
        console.groupCollapsed(`Parent page: received message ${data.message} from iframe`)
      } else {
        console.groupCollapsed(`Parent page: received message from iframe`)
      }

      console.info(JSON.stringify(data, undefined, 2))
      if (isHeightChangedMessage(data)) {
        if (!iframeRef.current) {
          console.error("Cannot send data to iframe because reference does not exist.")
          return
        }
        console.info("Updating height")
        // eslint-disable-next-line i18next/no-literal-string
        iframeRef.current.height = Number(data.data).toString() + "px"
      } else if (isOpenLinkMessage(data)) {
        console.info(`The iframe wants to open a link: ${data.data}`)

        window.open(data.data, "_blank", "noopener,noreferrer")
      } else if (isRequestIframeReloadMessage(data)) {
        scheduleIframeReload()
      } else if (isMessageFromIframe(data)) {
        if (!hasSignaledReadyRef.current) {
          hasSignaledReadyRef.current = true
          reloadAttemptsRef.current = 0
          if (reloadTimeoutRef.current !== null) {
            clearTimeout(reloadTimeoutRef.current)
            reloadTimeoutRef.current = null
          }
          onReady?.()
        }
        try {
          onMessageFromIframe(data, currentMessageChannel.port1)
        } catch (e) {
          console.error("onMessageFromIframe crashed", e)
        }
      } else {
        console.warn("unsupported message")
      }
      console.groupEnd()
    },
  )

  useEffect(() => {
    if (!messageChannel) {
      return
    }
    // We use port 1 for communication, defining a event handler
    messageChannel.port1.onmessage = (message: WindowEventMap["message"]) => {
      handlePortMessage(message, messageChannel)
    }

    const queuedMessages = readyMessageQueueRef.current
    if (queuedMessages.length > 0) {
      readyMessageQueueRef.current = []
      queuedMessages.forEach((e) => {
        if (e.data === "ready" && !portSentRef.current) {
          sendPortToIframe(messageChannel)
        }
      })
    }

    return () => {
      messageChannel.port1.onmessage = null
    }
  }, [handlePortMessage, messageChannel, sendPortToIframe])

  const handleInitialReadyMessage = useEventCallback((e: WindowEventMap["message"]) => {
    // Verify the source of the message. Origin can be "null" if the IFrame is
    // sandboxed without allow-same-origin, or it can be the same as window.location.origin
    if (
      (!disableSandbox && e.origin !== "null" && e.origin !== window.location.origin) ||
      e.source !== iframeRef.current?.contentWindow
    ) {
      if (e.data === "ready") {
        console.warn("[MessageChannelIFrame] Received ready message from invalid origin", {
          origin: e.origin,
          expectedOrigins: ["null", window.location.origin],
          isSandboxed: !disableSandbox,
        })
      }
      return
    }

    if (e.data !== "ready") {
      return
    }

    if (portSentRef.current && portSentTimestampRef.current) {
      const timeSinceSent = Date.now() - portSentTimestampRef.current
      if (timeSinceSent > RECOVERY_TIMEOUT_MS) {
        if (recoveryAttemptsRef.current < MAX_RECOVERY_ATTEMPTS) {
          console.warn(
            `[MessageChannelIFrame] Received ready message ${timeSinceSent}ms after sending port. Initiating recovery (attempt ${recoveryAttemptsRef.current + 1}/${MAX_RECOVERY_ATTEMPTS})`,
          )
          recoveryAttemptsRef.current += 1

          resetIframeConnectionState({ resetRecoveryAttempts: false })
          readyMessageQueueRef.current.push(e)
          recreateMessageChannel()
          return
        } else {
          console.error(
            `[MessageChannelIFrame] Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached. Giving up.`,
          )
        }
      }
      return
    }

    if (messageChannel) {
      sendPortToIframe(messageChannel)
    } else {
      readyMessageQueueRef.current.push(e)
    }
  })

  // Set up a temporary listener for the initial ready event
  useEffect(() => {
    const temporaryEventHandler = (e: WindowEventMap["message"]) => {
      handleInitialReadyMessage(e)
    }

    addEventListener("message", temporaryEventHandler)
    return () => {
      removeEventListener("message", temporaryEventHandler)
    }
  }, [handleInitialReadyMessage])

  // Keep the iframe informed of the current user interface language
  useEffect(() => {
    if (!messageChannel) {
      return
    }
    const message: SetLanguageMessage = {
      message: "set-language",
      data: language,
    }
    console.groupCollapsed(`Parent posting set-language message to iframe (${language})`)
    console.info(JSON.stringify(message, undefined, 2))
    console.groupEnd()
    messageChannel.port1.postMessage(message)
  }, [language, messageChannel])

  useEffect(() => {
    if (
      !postThisStateToIFrame ||
      !messageChannel ||
      isEqual(lastThingPostedRef.current, postThisStateToIFrame)
    ) {
      return
    }
    const postData: SetStateMessage = {
      ...postThisStateToIFrame,
      message: "set-state",
    }

    console.groupCollapsed(`Parent posting set-state message to iframe`)
    console.info(JSON.stringify(postData, undefined, 2))
    console.groupEnd()
    messageChannel.port1.postMessage(postData)
    lastThingPostedRef.current = postThisStateToIFrame
  }, [messageChannel, postThisStateToIFrame])

  if (!messageChannel) {
    return null
  }

  if (!url || url.trim() === "") {
    return <div>{t("error-cannot-render-dynamic-content-missing-url")}</div>
  }

  return (
    <div
      className={css`
        border: 0;
        /*
          To see the size of the frame in development
          Only top and bottom because frame is 100% of window width.
          */
        ${showBorders && `border: 1px solid black;`}
        margin-bottom: 1rem;
        background-color: #fff;
        padding: 0.8rem 1.25rem;
        border-radius: 0.625rem;
      `}
    >
      {headingBeforeIframe && (
        <h4
          className={css`
            padding-bottom: 0.5rem;
            font-weight: 600;
            font-size: 20px;
          `}
        >
          {headingBeforeIframe}
        </h4>
      )}
      <iframe
        sandbox={iframeSandboxAttribute}
        className={css`
          overflow: hidden;
          width: 100%;
          border: 0;
        `}
        title={title}
        key={reloadNonce}
        ref={iframeRef}
        src={url}
      />
      {reloadExhausted && (
        <div
          className={css`
            margin-top: 0.75rem;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            background-color: #fff3cd;
            color: #664d03;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.75rem;
          `}
        >
          <span>{t("exercise-iframe-reload-exhausted-message")}</span>
          <button
            type="button"
            className={css`
              border: none;
              border-radius: 9999px;
              padding: 0.35rem 0.9rem;
              font-size: 0.9rem;
              font-weight: 500;
              cursor: pointer;
              background-color: #0d6efd;
              color: #fff;
              white-space: nowrap;
            `}
            onClick={() => {
              reloadAttemptsRef.current = 0
              setReloadExhausted(false)
              scheduleIframeReload()
            }}
          >
            {t("exercise-iframe-reload-exhausted-reload-button")}
          </button>
        </div>
      )}
    </div>
  )
}

export default React.memo(MessageChannelIFrame)
