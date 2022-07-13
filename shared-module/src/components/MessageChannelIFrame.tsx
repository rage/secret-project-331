import { css } from "@emotion/css"
import { isEqual } from "lodash"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import useMessageChannel from "../hooks/useMessageChannel"
import { CurrentStateMessage, IframeState, SetStateMessage } from "../iframe-protocol-types"
import { isCurrentStateMessage, isHeightChangedMessage } from "../iframe-protocol-types.guard"

import BreakFromCentered, { BreakFromCenteredProps } from "./Centering/BreakFromCentered"

interface MessageChannelIFrameProps {
  url: string
  postThisStateToIFrame: IframeState | null
  onMessageFromIframe: (message: CurrentStateMessage, responsePort: MessagePort) => void
  breakFromCenteredProps?: BreakFromCenteredProps
  title: string
  showBorders?: boolean
}

// const IFRAME_TITLE = "Exercise type specific content"

const MessageChannelIFrame: React.FC<MessageChannelIFrameProps> = ({
  url,
  postThisStateToIFrame,
  onMessageFromIframe,
  breakFromCenteredProps,
  title,
  showBorders = false,
}) => {
  const { t } = useTranslation()
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
      console.groupEnd()
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
    // We have to force the iframe to take the full width of the page because the iframe protocol requires it
    <BreakFromCentered {...(breakFromCenteredProps ?? { sidebar: false })}>
      <div
        className={css`
          border: 0;
          /*
          To see the size of the frame in development
          Only top and bottom because frame is 100% of window width.
          */
          ${showBorders &&
          `border-top: 1px solid black;
          border-bottom: 1px solid black;`}
          margin-bottom: 1rem;
        `}
      >
        <iframe
          sandbox="allow-scripts allow-forms"
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
    </BreakFromCentered>
  )
}

export default React.memo(MessageChannelIFrame)
