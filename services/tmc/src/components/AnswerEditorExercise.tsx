import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import type { UploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { ACCEPTED_ARCHIVE_EXTENSIONS } from "@/util/archiveTypes"
import type { PublicSpec } from "@/util/stateInterfaces"

const VSCODE_EXTENSION_URL =
  "https://marketplace.visualstudio.com/items?itemName=moocfi.test-my-code"

interface Props {
  publicSpec: PublicSpec
  sendFileUploadMessage: (file: File) => void
  fileUploadResponse: UploadResultMessage | null
}

const AnswerEditorExercise: React.FC<React.PropsWithChildren<Props>> = ({
  publicSpec,
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
        {t("install-extension-instructions")}{" "}
        <a href={VSCODE_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
          {t("extension-marketplace-link")}
        </a>
      </div>
      <div>
        <a href={publicSpec.stub_download_url}>
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
        <Button variant="primary" size="medium" aria-label={t("select-file-for-submission")}>
          <input
            type="file"
            accept={ACCEPTED_ARCHIVE_EXTENSIONS.join(",")}
            ref={inputRef}
            onChange={(ev) => {
              if (ev.target && ev.target.files && ev.target.files.length > 0) {
                setFileToUpload(ev.target.files[0] ?? null)
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
              sendFileUploadMessage(fileToUpload)
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
