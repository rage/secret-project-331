import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { PublicSpec } from "../util/stateInterfaces"

import Button from "@/shared-module/common/components/Button"
import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"

interface Props {
  initialPublicSpec: PublicSpec & { type: "editor" }
  sendFileUploadMessage: (filename: string, file: File) => void
  fileUploadResponse: UploadResultMessage | null
}

const AnswerEditorExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  const { t } = useTranslation()

  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // solved in an external editor
  return (
    <>
      <div>{t("solve-in-editor-instructions")}</div>
      <div>
        <a href={initialPublicSpec.archive_download_url}>
          <Button variant={"primary"} size={"small"}>
            {t("download-exercise")}
          </Button>
        </a>
      </div>
      <hr />
      <div>
        <label>{t("upload-solution-instructions")}</label>
        <div>{t("select-file-for-submission")}</div>
        <br />
        <Button variant="primary" size="medium">
          <input
            type="file"
            ref={inputRef}
            onChange={(ev) => {
              if (ev.target && ev.target.files && ev.target.files.length > 0) {
                setFileToUpload(ev.target.files[0])
              }
            }}
          />
        </Button>
        <br />
        <Button
          variant="primary"
          size="medium"
          disabled={fileToUpload === null}
          onClick={() => {
            if (fileToUpload) {
              // eslint-disable-next-line i18next/no-literal-string
              sendFileUploadMessage(`submission-${initialPublicSpec.archive_name}`, fileToUpload)
            }
          }}
        >
          {t("save-file-for-submission")}
        </Button>
        <Button
          variant="tertiary"
          size="medium"
          disabled={fileToUpload === null}
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = ""
            }
            setFileToUpload(null)
          }}
        >
          {t("reset-file")}
        </Button>
        {fileUploadResponse !== null ? (
          fileUploadResponse.success ? (
            <div>{t("file-upload-save-success")}</div>
          ) : (
            <div>
              {t("file-upload-save-failure")}: {fileUploadResponse.error}
            </div>
          )
        ) : (
          <div>{t("no-file-saved-yet")}</div>
        )}
      </div>
    </>
  )
}

export default AnswerEditorExercise
