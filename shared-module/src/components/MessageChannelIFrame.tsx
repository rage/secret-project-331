import { css } from "@emotion/css"
import { isEqual } from "lodash"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  IframeState,
  MessageFromIframe,
  SetLanguageMessage,
  SetStateMessage,
} from "../exercise-service-protocol-types"
import {
  isHeightChangedMessage,
  isMessageFromIframe,
} from "../exercise-service-protocol-types.guard"
import useMessageChannel from "../hooks/useMessageChannel"

import { BreakFromCenteredProps } from "./Centering/BreakFromCentered"

interface MessageChannelIFrameProps {
  url: string
  postThisStateToIFrame: IframeState | null
  onMessageFromIframe: (message: MessageFromIframe, responsePort: MessagePort) => void
  breakFromCenteredProps?: BreakFromCenteredProps
  title: string
  showBorders?: boolean
  disableSandbox?: boolean
}

// const IFRAME_TITLE = "Exercise type specific content"

const MessageChannelIFrame: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<MessageChannelIFrameProps>>
> = ({
  url,
  postThisStateToIFrame,
  onMessageFromIframe,

  title,
  showBorders = false,
  disableSandbox = false,
}) => {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [lastThingPosted, setLastThingPosted] = useState<unknown>(null)

  const messageChannel = useMessageChannel()

  useEffect(() => {
    if (!messageChannel) {
      return
    }
    // We use port 1 for communication, defining a event handler
    messageChannel.port1.onmessage = (message: WindowEventMap["message"]) => {
      const data = message.data
      if (data.message) {
        // eslint-disable-next-line i18next/no-literal-string
        console.groupCollapsed(`Parent page: received message ${data.message} from iframe`)
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        console.groupCollapsed(`Parent page: received message from iframe`)
      }

      console.info(JSON.stringify(data, undefined, 2))
      if (isHeightChangedMessage(data)) {
        if (!iframeRef.current) {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("Cannot send data to iframe because reference does not exist.")
          return
        }
        // eslint-disable-next-line i18next/no-literal-string
        console.info("Updating height")
        // eslint-disable-next-line i18next/no-literal-string
        iframeRef.current.height = Number(data.data).toString() + "px"
      } else if (isMessageFromIframe(data)) {
        try {
          onMessageFromIframe(data, messageChannel.port1)
        } catch (e) {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("onMessageFromIframe crashed", e)
        }
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        console.warn("unsupported message")
      }
      console.groupEnd()
    }
  }, [messageChannel, onMessageFromIframe])

  // Set up a temporary listener for the initial ready event
  useEffect(() => {
    if (!messageChannel) {
      return
    }
    const temporaryEventHandler = (e: WindowEventMap["message"]) => {
      // Verify the source of the message. Origin is always null if the IFrame is
      // sandboxed without allow-same-origin
      if (
        (!disableSandbox && e.origin !== "null") ||
        e.source !== iframeRef.current?.contentWindow
      ) {
        return
      }
      if (e.data !== "ready") {
        // eslint-disable-next-line i18next/no-literal-string
        console.warn(`Unsupported message from IFrame: ${e.data}`)
        return
      }

      if (iframeRef.current && iframeRef.current.contentWindow) {
        // eslint-disable-next-line i18next/no-literal-string
        console.info("Parent posting message port to iframe")
        try {
          // The iframe will use port 2 for communication
          iframeRef.current.contentWindow.postMessage("communication-port", "*", [
            messageChannel.port2,
          ])
        } catch (e) {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("Posting communication port to iframe failed", e)
        }
      } else {
        console.error(
          // eslint-disable-next-line i18next/no-literal-string
          "Could not send port to iframe because the target iframe content window could not be found.",
        )
      }
      removeEventListener("message", temporaryEventHandler)
    }
    addEventListener("message", temporaryEventHandler)
    return () => {
      removeEventListener("message", temporaryEventHandler)
    }
  }, [disableSandbox, messageChannel])

  // Keep the iframe informed of the current user interface language
  useEffect(() => {
    if (!messageChannel) {
      return
    }
    const message: SetLanguageMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "set-language",
      data: language,
    }
    // eslint-disable-next-line i18next/no-literal-string
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
      // eslint-disable-next-line i18next/no-literal-string
      message: "set-state",
    }

    // eslint-disable-next-line i18next/no-literal-string
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
        background-color: rebeccapurple;
      `}
    >
      <iframe
        sandbox={disableSandbox ? undefined : "allow-scripts allow-forms allow-downloads"}
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
