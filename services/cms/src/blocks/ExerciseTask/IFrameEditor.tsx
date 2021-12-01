import { Alert } from "@material-ui/lab"
import React from "react"
import { useTranslation } from "react-i18next"
import { useMemoOne } from "use-memo-one"

import MessageChannelIFrame from "../../shared-module/components/MessageChannelIFrame"
import { ViewType } from "../../shared-module/iframe-protocol-types"
import { isCurrentStateMessage } from "../../shared-module/iframe-protocol-types.guard"

const VIEW_TYPE: ViewType = "exercise-editor"
const UNEXPECTED_MESSAGE_ERROR = "Unexpected message or structure is not valid."

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
  const { t } = useTranslation()

  const postThisStateToIFrame = useMemoOne(() => {
    return { view_type: VIEW_TYPE, data: privateSpec }
  }, [privateSpec])

  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }

  console.log(url)
  return (
    <MessageChannelIFrame
      url={url}
      postThisStateToIFrame={postThisStateToIFrame}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPrivateSpecChange(JSON.stringify((messageContainer.data as any).private_spec))
        } else {
          console.error(UNEXPECTED_MESSAGE_ERROR)
        }
      }}
    />
  )
}

export default ExerciseTaskIFrameEditor
