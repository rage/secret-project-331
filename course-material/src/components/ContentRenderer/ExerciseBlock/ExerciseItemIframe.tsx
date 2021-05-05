import { Dispatch, useEffect, useRef } from "react"
import { Alert } from "@material-ui/lab"
import styled from "@emotion/styled"
import React from "react"
import { css } from "@emotion/css"
import useMessageChannel from "../../../hooks/useMessageChannel"

// React memo to prevent iFrame re-render, try with console log from example exercise?
const Iframe = React.memo(styled.iframe`
  width: 100%;

  /*
   To see the size of the frame in development
   Only top and bottom because frame is 100% of window width
   and extra border would create a scrollbar
  */
  border-top: 1px solid black;
  border-bottom: 1px solid black;
`)

interface ExerciseItemIframeProps {
  url: string
  public_spec: unknown
  setAnswer: Dispatch<unknown>
}

const ExerciseItemIframe: React.FC<ExerciseItemIframeProps> = ({ url, public_spec, setAnswer }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const messageChannel = useMessageChannel()

  if (!messageChannel) {
    return null
  }

  if (!url) {
    return <Alert severity="error">Cannot render exercise item editor, missing url.</Alert>
  }
  return (
    <Iframe
      className={css`
        overflow: hidden;
      `}
      ref={iframeRef}
      src={url}
      onLoad={() => {
        // We use port 1 for communication
        messageChannel.port1.onmessage = (message: WindowEventMap["message"]) => {
          console.log("Parent received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (data.message === "height-changed") {
            if (!iframeRef.current) {
              console.error("Cannot send data to iframe because reference does not exist.")
              return
            }
            console.log("Updating height")
            iframeRef.current.height = Number(data.data).toString() + "px"
          } else if (data.message === "current-state-2") {
            console.log("Parent: setting answer")
            setAnswer(data.data)
          } else {
            console.error("Iframe received an unknown message from message port")
          }
        }
        // Second argument in the url constructor enables the constructor to work with relative urls.
        // If the url is not relative, the argument will be ignored
        const iframeOrigin = new URL(url, document.location.toString()).origin
        if (iframeRef.current && iframeRef.current.contentWindow) {
          // The iframe will use port 2 for communication
          iframeRef.current.contentWindow.postMessage("communication-port", iframeOrigin, [
            messageChannel.port2,
          ])
          messageChannel.port1.postMessage({
            message: "content",
            data: public_spec,
          })
        } else {
          console.error(
            "Could not send port to iframe because the target iframe content window could not be found.",
          )
        }
      }}
      frameBorder="off"
    />
  )
}

const handleMessageCreator = (
  iframeRef: HTMLIFrameElement | null,
  public_spec: unknown,
  setAnswer: Dispatch<unknown>,
) => {
  return async function handleMessage(event: WindowEventMap["message"]) {
    if (
      event.data.message_type !== "moocfi/exercise-message" ||
      (iframeRef && iframeRef.contentWindow !== event.source)
    ) {
      return
    }
    console.log("Parent received an event: ", JSON.stringify(event.data))

    switch (event.data.message) {
      case "ready": {
        if (!iframeRef) {
          console.error("Cannot send data to iframe because reference does not exist.")
          return
        }
        const contentWindow = iframeRef.contentWindow
        if (!contentWindow) {
          console.error("No frame content window")
          return
        }
        // Set the initial state that is found in Gutenberg JSON?
        contentWindow.postMessage(
          {
            message: "content",
            message_type: "moocfi/exercise-message",
            data: public_spec,
          },
          "*",
        )
        return
      }
      case "height-changed": {
        // Häkki solution to get rid of useState for iFrameHeight and well... scrollbar.
        if (!iframeRef) {
          console.error("Cannot send data to iframe because reference does not exist.")
          return
        }
        iframeRef.height = (Number(event.data.data) + 10).toString() + "px"
        return
      }
      case "current-state2": {
        setAnswer(event.data.data)
        return
      }
      default: {
        console.warn("Unexpected message", JSON.stringify(event.data))
        return
      }
    }
  }
}

export default ExerciseItemIframe
