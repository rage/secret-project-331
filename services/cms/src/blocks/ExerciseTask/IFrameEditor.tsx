import { Alert } from "@material-ui/lab"
import { BlockEditProps } from "@wordpress/blocks"
import React, { PropsWithChildren, useState } from "react"

import MessageChannelIFrame from "../../shared-module/components/MessageChannelIFrame"
import { SetStateMessage } from "../../shared-module/iframe-protocol-types"
import { isCurrentStateMessage } from "../../shared-module/iframe-protocol-types.guard"

import { ExerciseTaskAttributes } from "."

interface IFrameEditorProps {
  props: PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>
  url: string | null | undefined
  exerciseTaskid: string
}

const IFrameEditor: React.FC<IFrameEditorProps> = ({ url, props }) => {
  const [specParseable, setSpecParseable] = useState(true)
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
  }
  if (!specParseable) {
    return (
      <>
        <Alert severity="error">Spec not parseable.</Alert>
        <pre>{props.attributes.private_spec}</pre>
      </>
    )
  }
  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
        console.log("communication channel established")
        let parsedPrivateSpec = null
        try {
          parsedPrivateSpec = JSON.parse(props.attributes.private_spec ?? null)
        } catch (e) {
          setSpecParseable(false)
          return
        }
        const message: SetStateMessage = { message: "set-state", data: parsedPrivateSpec }
        port.postMessage(message)
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          props.setAttributes({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            private_spec: JSON.stringify((messageContainer.data as any).private_spec),
          })
        } else {
          console.error("Unexpected message or structure is not valid.")
        }
      }}
    />
  )
}

export default IFrameEditor
