import React, { createRef } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import { PublicSpec } from "../util/stateInterfaces"

interface Props {
  initialPublicSpec: PublicSpec & { type: "editor" }
  sendFileUploadMessage: (files: Map<string, string | Blob>) => void
}

type FileInputElement = HTMLInputElement

const AnswerEditorExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  sendFileUploadMessage,
}) => {
  const { t } = useTranslation()

  const fileInput = createRef<FileInputElement>()

  // solved in an external editor
  return (
    <>
      <div>{t("solve-in-editor-instructions")}</div>
      <div>
        <a href={initialPublicSpec.archiveDownloadUrl}>
          <Button variant={"primary"} size={"small"}>
            {t("download-exercise")}
          </Button>
        </a>
      </div>
      <hr />
      <div>
        <label>{t("upload-solution-instructions")}</label>
        <br />
        <input
          type="file"
          ref={fileInput}
          onChange={(ev) => {
            if (ev.target && ev.target.files) {
              const map = new Map()
              for (let i = 0; i < ev.target.files.length; i++) {
                const fileToUpload = ev.target.files[i]
                map.set(fileToUpload.name, fileToUpload)
              }
              sendFileUploadMessage(map)
            }
          }}
        />
      </div>
    </>
  )
}

export default AnswerEditorExercise
