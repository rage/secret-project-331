import { Alert } from "@material-ui/lab"
import { BlockEditProps } from "@wordpress/blocks"
import React, { PropsWithChildren, useState } from "react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()

  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }

  if (!specParseable) {
    return (
      <>
        <Alert severity="error">{t("error-spec-not-parseable")}</Alert>
        <pre>{JSON.stringify(privateSpec)}</pre>
      </>
    )
  }

  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
        // eslint-disable-next-line i18next/no-literal-string
        console.info("communication channel established")
        let parsedPrivateSpec = null
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsedPrivateSpec = JSON.parse(privateSpec as any)
        } catch (e) {
          setSpecParseable(false)
          return
        }
        // eslint-disable-next-line i18next/no-literal-string
        const message: SetStateMessage = { message: "set-state", data: parsedPrivateSpec }
        port.postMessage(message)
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPrivateSpecChange(JSON.stringify((messageContainer.data as any).private_spec))
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("Unexpected message or structure is not valid.")
        }
      }}
    />
  )
}

export default ExerciseTaskIFrameEditor
