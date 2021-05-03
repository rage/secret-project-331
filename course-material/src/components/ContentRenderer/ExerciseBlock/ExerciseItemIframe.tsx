import { Dispatch, useEffect, useRef } from "react"
import { Alert } from "@material-ui/lab"
import styled from "@emotion/styled"
import React from "react"

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

  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    console.log("Adding event listener...")
    const handleMessage = handleMessageCreator(iframeRef.current, public_spec, setAnswer)
    window.addEventListener("message", handleMessage)
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!url) {
    return <Alert severity="error">Cannot render exercise item editor, missing url.</Alert>
  }
  return <Iframe ref={iframeRef} src={url} frameBorder="off" />
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
