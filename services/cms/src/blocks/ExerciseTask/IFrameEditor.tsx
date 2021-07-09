import { Alert } from "@material-ui/lab"
import { BlockEditProps } from "@wordpress/blocks"
import React, { PropsWithChildren } from "react"

import MessageChannelIFrame from "../../shared-module/components/MessageChannelIFrame"

import { ExerciseTaskAttributes } from "."

interface IFrameEditorProps {
  props: PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>
  url: string
  exerciseTaskid: string
}

const IFrameEditor: React.FC<IFrameEditorProps> = ({ url, props }) => {
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
  }
  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
        console.log("communication channel established")
        port.postMessage({ message: "set-state", data: JSON.parse(props.attributes.private_spec) })
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uncheckedMessage = (messageContainer as any).message
        if (!uncheckedMessage) {
          console.error("Invalid message. No message field")
          return
        }
        if (uncheckedMessage === "current-state") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uncheckedData = (messageContainer as any).data
          if (!uncheckedData || !uncheckedData.private_spec || !uncheckedData.public_spec) {
            console.error("Invalid message")
            return
          }
          props.setAttributes({
            public_spec: JSON.stringify(uncheckedData.public_spec),
            private_spec: JSON.stringify(uncheckedData.private_spec),
          })
        }
      }}
    />
  )
}

export default IFrameEditor
