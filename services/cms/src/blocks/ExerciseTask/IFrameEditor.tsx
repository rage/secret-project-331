import { Alert } from "@mui/lab"
import React from "react"
import { useTranslation } from "react-i18next"
import { useMemoOne } from "use-memo-one"

import { SIDEBAR_WIDTH_PX } from "../../components/Layout"
import MessageChannelIFrame from "../../shared-module/components/MessageChannelIFrame"
import useMedia from "../../shared-module/hooks/useMedia"
import { IframeState } from "../../shared-module/iframe-protocol-types"
import { isCurrentStateMessage } from "../../shared-module/iframe-protocol-types.guard"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withNoSsr from "../../shared-module/utils/withNoSsr"

const VIEW_TYPE = "exercise-editor"
const UNEXPECTED_MESSAGE_ERROR = "Unexpected message or structure is not valid."

interface ExerciseTaskIFrameEditorProps {
  exerciseTaskId: string
  onPrivateSpecChange(newSpec: unknown): void
  privateSpec: unknown
  url: string | null | undefined
}

const ExerciseTaskIFrameEditor: React.FC<ExerciseTaskIFrameEditorProps> = ({
  exerciseTaskId,
  onPrivateSpecChange,
  privateSpec,
  url,
}) => {
  const { t } = useTranslation()

  const largeScreen = useMedia(respondToOrLarger.xl)

  const postThisStateToIFrame: IframeState = useMemoOne(() => {
    return {
      view_type: VIEW_TYPE,
      exercise_task_id: exerciseTaskId,
      data: { private_spec: privateSpec },
    }
  }, [privateSpec])

  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }

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
      breakFromCenteredProps={
        largeScreen
          ? {
              sidebar: true,
              // eslint-disable-next-line i18next/no-literal-string
              sidebarWidth: `${SIDEBAR_WIDTH_PX}px`,
              // eslint-disable-next-line i18next/no-literal-string
              sidebarPosition: "right",
            }
          : undefined
      }
    />
  )
}

// withNoSsr used here because this component uses the useMedia hook and if we accidentally rendered this on the server, we could get rehydation mismatches which could break react rendering
export default withNoSsr(ExerciseTaskIFrameEditor)
