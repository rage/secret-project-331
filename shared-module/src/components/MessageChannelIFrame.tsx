import { css } from "@emotion/css"
import React, { useEffect, useRef } from "react"

import useMessageChannel from "../hooks/useMessageChannel"

interface MessageChannelIFrameProps {
  url: string
  onCommunicationChannelEstabilished: (port: MessagePort) => void
  onMessageFromIframe: (message: unknown, responsePort: MessagePort) => void
}

const MessageChannelIFrame: React.FC<MessageChannelIFrameProps> = ({
  url,
  onCommunicationChannelEstabilished,
  onMessageFromIframe,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // needed because we cannot execute again the temporary event handler useEffect
  // whenever this changes.
  const onCommunicationChannelEstabilishedRef = useRef(onCommunicationChannelEstabilished)

  const messageChannel = useMessageChannel()

  useEffect(() => {
    if (!messageChannel) {
      return
    }
    // We use port 1 for communication, defining a event handler
    messageChannel.port1.onmessage = (message: WindowEventMap["message"]) => {
      const data = message.data
      console.info("Received message", JSON.stringify(data))
      if (data.message === "height-changed") {
        if (!iframeRef.current) {
          console.error("Cannot send data to iframe because reference does not exist.")
          return
        }
        console.log("Updating height")
        iframeRef.current.height = Number(data.data).toString() + "px"
      } else {
        try {
          onMessageFromIframe(message.data, messageChannel.port1)
        } catch (e) {
          console.error("onMessageFromIframe crashed", e)
        }
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
        console.warn(`Unsupported message from IFrame: ${e.data}`)
        return
      }

      if (iframeRef.current && iframeRef.current.contentWindow) {
        // The iframe will use port 2 for communication
        iframeRef.current.contentWindow.postMessage("communication-port", "*", [
          messageChannel.port2,
        ])
        try {
          onCommunicationChannelEstabilishedRef.current(messageChannel.port1)
        } catch (e) {
          console.error("onCommunicationChannelEstabilished crashed", e)
        }
      } else {
        console.error(
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

  if (!messageChannel) {
    return null
  }

  if (!url || url.trim() === "") {
    return <div>Cannot render IFRame, missing url.</div>
  }

  return (
    <iframe
      sandbox="allow-scripts"
      className={css`
        overflow: hidden;
        width: 100%;

        /*
         To see the size of the frame in development
         Only top and bottom because frame is 100% of window width
         and extra border would create a scrollbar
        */
        border: 0;
        border-top: 1px solid black;
        border-bottom: 1px solid black;
      `}
      ref={iframeRef}
      src={url}
    />
  )
}

export default React.memo(MessageChannelIFrame)
