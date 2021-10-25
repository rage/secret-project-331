import { Alert } from "@material-ui/lab"
import React, { useState } from "react"

import MessageChannelIFrame from "../../shared-module/components/MessageChannelIFrame"
import { SetStateMessage } from "../../shared-module/iframe-protocol-types"
import { isCurrentStateMessage } from "../../shared-module/iframe-protocol-types.guard"

interface ExerciseTaskIFrameEditorProps {
  onPrivateSpecChange(newSpec: unknown): void
  privateSpec: unknown
  url: string | null | undefined
}

const ExerciseTaskIFrameEditor: React.FC<ExerciseTaskIFrameEditorProps> = ({
  onPrivateSpecChange,
  privateSpec,
  url,
}) => {
  const [specParseable, setSpecParseable] = useState(true)
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
  }

  if (!specParseable) {
    return (
      <>
        <Alert severity="error">Spec not parseable.</Alert>
        <pre>{JSON.stringify(privateSpec)}</pre>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsedPrivateSpec = JSON.parse(privateSpec as any)
        } catch (e) {
          setSpecParseable(false)
          return
        }
        const message: SetStateMessage = { message: "set-state", data: parsedPrivateSpec }
        port.postMessage(message)
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPrivateSpecChange(JSON.stringify((messageContainer.data as any).private_spec))
        } else {
          console.error("Unexpected message or structure is not valid.")
        }
      }}
    />
  )
}

export default ExerciseTaskIFrameEditor
