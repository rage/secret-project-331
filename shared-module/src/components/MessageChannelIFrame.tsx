import { css } from "@emotion/css"
import { isEqual } from "lodash"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import useMessageChannel from "../hooks/useMessageChannel"
import { CurrentStateMessage, SetStateMessage } from "../iframe-protocol-types"
import { isCurrentStateMessage, isHeightChangedMessage } from "../iframe-protocol-types.guard"

interface MessageChannelIFrameProps {
  url: string
  postThisStateToIFrame: Omit<SetStateMessage, "message">
  onMessageFromIframe: (message: CurrentStateMessage, responsePort: MessagePort) => void
}

const MessageChannelIFrame: React.FC<MessageChannelIFrameProps> = ({
  url,
  postThisStateToIFrame,
  onMessageFromIframe,
}) => {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [lastThingPosted, setLastThingPosted] = useState<any>(null)

  const messageChannel = useMessageChannel()

  useEffect(() => {
    if (!messageChannel) {
      return
    }
    // We use port 1 for communication, defining a event handler
    messageChannel.port1.onmessage = (message: WindowEventMap["message"]) => {
      const data = message.data
      // eslint-disable-next-line i18next/no-literal-string
      console.info("Received message", JSON.stringify(data))
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
      } else if (isCurrentStateMessage(data)) {
        try {
          onMessageFromIframe(message.data, messageChannel.port1)
        } catch (e) {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("onMessageFromIframe crashed", e)
        }
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        console.warn("unsupported message")
      }
    }
  }, [messageChannel, onMessageFromIframe])

  // Set up a temporary listener for the initial ready event
  useEffect(() => {
    if (!messageChannel) {
      return
    }
    const temporaryEventHandler = (e: WindowEventMap["message"]) => {
      // Verify the source of the message. Origin is always null because the IFrame is
      // sandboxed without allow-same-origin
      if (e.origin !== "null" || e.source !== iframeRef.current?.contentWindow) {
        return
      }
      if (e.data !== "ready") {
        // eslint-disable-next-line i18next/no-literal-string
        console.warn(`Unsupported message from IFrame: ${e.data}`)
        return
      }

      if (iframeRef.current && iframeRef.current.contentWindow) {
        // The iframe will use port 2 for communication
        iframeRef.current.contentWindow.postMessage("communication-port", "*", [
          messageChannel.port2,
        ])
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
  }, [messageChannel])

  useEffect(() => {
    if (!messageChannel || isEqual(lastThingPosted, postThisStateToIFrame)) {
      return
    }
    const postData: SetStateMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "set-state",
      view_type: postThisStateToIFrame.view_type,
      data: postThisStateToIFrame.data,
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.log(`parent posting data ${postData}`)
    messageChannel.port1.postMessage(postData)
    setLastThingPosted(postThisStateToIFrame)
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
        /*
          To see the size of the frame in development
          Only top and bottom because frame is 100% of window width.
        */
        border: 0;
        border-top: 1px solid black;
        border-bottom: 1px solid black;
      `}
    >
      <iframe
        sandbox="allow-scripts"
        className={css`
          overflow: hidden;
          width: 100%;
          border: 0;
        `}
        title="Exercise type specific content"
        ref={iframeRef}
        src={url}
      />
    </div>
  )
}

export default React.memo(MessageChannelIFrame)
