import { Alert } from "@material-ui/lab"
import { BlockEditProps } from "@wordpress/blocks"
import React, { PropsWithChildren, useState } from "react"
import { useTranslation } from "react-i18next"

import MessageChannelIFrame from "../../shared-module/components/MessageChannelIFrame"
import { isCurrentStateMessage } from "../../shared-module/iframe-protocol-types.guard"

import { ExerciseTaskAttributes } from "."

interface IFrameEditorProps {
  props: PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>
  url: string | null | undefined
  exerciseTaskid: string
}

const IFrameEditor: React.FC<IFrameEditorProps> = ({ url, props }) => {
  const { t } = useTranslation()
  const [specParseable, setSpecParseable] = useState(true)
  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }
  if (!specParseable) {
    return (
      <>
        <Alert severity="error">{t("error-spec-not-parseable")}</Alert>
        <pre>{props.attributes.private_spec}</pre>
      </>
    )
  }
  let parsedPrivateSpec = null
  try {
    parsedPrivateSpec = JSON.parse(props.attributes.private_spec ?? null)
  } catch (e) {
    setSpecParseable(false)
    return
  }

  console.log(url)
  return (
    <MessageChannelIFrame
      url={url}
      // eslint-disable-next-line i18next/no-literal-string
      postThisStateToIFrame={{ view_type: "exercise-editor", data: parsedPrivateSpec }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          props.setAttributes({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            private_spec: JSON.stringify((messageContainer.data as any).private_spec),
          })
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("Unexpected message or structure is not valid.")
        }
      }}
    />
  )
}

export default IFrameEditor
