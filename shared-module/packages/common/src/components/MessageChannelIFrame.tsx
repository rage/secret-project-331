import { css } from "@emotion/css"
import { isEqual } from "lodash"
import React, { useEffect, useRef, useState } from "react"
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
} from "../exercise-service-protocol-types.guard"
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
}) => {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeSandboxAttribute = useIframeSandboxingAttribute(disableSandbox)

  const [lastThingPosted, setLastThingPosted] = useState<unknown>(null)

  const [messageChannel, recreateMessageChannel] = useMessageChannel()
  const portSentRef = useRef(false)
  const portSentTimestampRef = useRef<number | null>(null)
  const recoveryAttemptsRef = useRef(0)
  const readyMessageQueueRef = useRef<MessageEvent[]>([])

  const MAX_RECOVERY_ATTEMPTS = 3
  const RECOVERY_TIMEOUT_MS = 5000

  useEffect(() => {
    portSentRef.current = false
    portSentTimestampRef.current = null
    recoveryAttemptsRef.current = 0
    readyMessageQueueRef.current = []
    setLastThingPosted(null)
  }, [url])

  const sendPortToIframe = (messageChannel: MessageChannel, isRecovery = false) => {
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
  }

  useEffect(() => {
    if (!messageChannel) {
      return
    }
    // We use port 1 for communication, defining a event handler
    messageChannel.port1.onmessage = (message: WindowEventMap["message"]) => {
      const data = message.data
      if (data.message) {
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
      } else if (isMessageFromIframe(data)) {
        try {
          onMessageFromIframe(data, messageChannel.port1)
        } catch (e) {
          console.error("onMessageFromIframe crashed", e)
        }
      } else {
        console.warn("unsupported message")
      }
      console.groupEnd()
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
  }, [messageChannel, onMessageFromIframe])

  // Set up a temporary listener for the initial ready event
  useEffect(() => {
    const temporaryEventHandler = (e: WindowEventMap["message"]) => {
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

            portSentRef.current = false
            portSentTimestampRef.current = null
            setLastThingPosted(null)

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
    }

    addEventListener("message", temporaryEventHandler)
    return () => {
      removeEventListener("message", temporaryEventHandler)
    }
  }, [disableSandbox, messageChannel, recreateMessageChannel])

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
      isEqual(lastThingPosted, postThisStateToIFrame)
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
    setLastThingPosted(postThisStateToIFrame)

    // eslint-disable-next-line react-hooks/exhaustive-deps -- lastThingPosted is only used to cancel reposting when postThisStateToIFrame has not changed. Adding it to the dependency array would cause an infinite loop.
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
        ref={iframeRef}
        src={url}
      />
    </div>
  )
}

export default React.memo(MessageChannelIFrame)
