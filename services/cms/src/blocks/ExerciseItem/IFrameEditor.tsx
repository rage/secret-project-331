import { PropsWithChildren, useRef } from "react"
import { Alert } from "@material-ui/lab"
import styled from "@emotion/styled"
import React from "react"
import { ExerciseItemAttributes } from "."
import { BlockEditProps } from "@wordpress/blocks"
import { css } from "@emotion/css"
import useMessageChannel from "../../hooks/useMessageChannel"

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

interface IFrameEditorProps {
  props: PropsWithChildren<BlockEditProps<ExerciseItemAttributes>>
  url: string
  exerciseItemid: string
}

const IFrameEditor: React.FC<IFrameEditorProps> = ({ url, props }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const messageChannel = useMessageChannel()

  if (!messageChannel) {
    return null
  }

  if (!url) {
    return <Alert severity="error">Cannot render exercise item, missing url.</Alert>
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
            props.setAttributes({
              public_spec: JSON.stringify(data.data.public_spec),
              private_spec: JSON.stringify(data.data.private_spec),
            })
          } else {
            console.error("Iframe received an unknown message from message port")
          }
        }
        // Second argument in the url constructor enables the constructor to work with relative urls.
        // If the url is not relative, the argument will be ignored
        const iframeOrigin = new URL(url, document.location.toString()).origin
        if (iframeRef.current && iframeRef.current.contentWindow) {
          setTimeout(() => {
            // The iframe will use port 2 for communication
            iframeRef.current.contentWindow.postMessage("communication-port", iframeOrigin, [
              messageChannel.port2,
            ])
          }, 1)

          messageChannel.port1.postMessage({
            message: "content",
            data: JSON.parse(props.attributes.private_spec),
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

export default IFrameEditor
