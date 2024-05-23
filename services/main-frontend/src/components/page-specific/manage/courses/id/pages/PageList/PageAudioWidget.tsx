import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CloseIcon from "../../../../../../../imgs/close.svg"
import TrashIcon from "../../../../../../../imgs/trash.svg"
import {
  postPageAudioFile,
  removePageAudioFile,
} from "../../../../../../../services/backend/page-audio-files"
import { fetchPageAudioFiles } from "../../../../../../../services/backend/pages"

import Dialog from "@/shared-module/common/components/Dialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { runCallbackIfEnterPressed } from "@/shared-module/common/utils/accessibility"

const ACCEPTABLE_MIME_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  // Some audio files are detected as video/ogg even though they are audio files
  "video/ogg",
]

export interface AudioUploadAttributes {
  id: string | null
  open: boolean
  onClose: () => void
}

const PageAudioWidget: React.FC<React.PropsWithChildren<AudioUploadAttributes>> = ({
  id,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  const pageId = id

  const getPageAudioFiles = useQuery({
    queryKey: [`page-${pageId}-audio-files`],
    queryFn: () => {
      // fetchPageAudioFiles(pageId),
      if (pageId) {
        return fetchPageAudioFiles(pageId)
      } else {
        return Promise.reject(new Error("Page ID undefined"))
      }
    },
    enabled: !!pageId,
  })

  const deletePageAudioFile = useToastMutation(
    (fileId: string) => removePageAudioFile(fileId),
    {
      notify: true,
      successMessage: t("audio-deleted-successfully"),
      method: "DELETE",
    },
    {
      onSuccess: () => {
        getPageAudioFiles.refetch()
      },
    },
  )

  const uploadAudioFileMutation = useToastMutation(
    (file: File) => {
      if (!pageId) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("Page ID undefined")
      }

      return postPageAudioFile(pageId, file)
    },
    {
      notify: true,
      successMessage: t("audio-added-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        getPageAudioFiles.refetch()
      },
    },
  )

  const handleUpload = (event: React.ChangeEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!event.currentTarget.audioFile) {
      return
    }
    const file: File | null = event.currentTarget.audioFile.files[0]

    if (file) {
      if (!ACCEPTABLE_MIME_TYPES.includes(file.type)) {
        console.error("The audio format is not accepted")
        throw new Error("The audio format is not accepted")
      }
      uploadAudioFileMutation.mutate(file)
      event.currentTarget.audioFile.value = null
    }
  }

  return (
    <Dialog open={open} onClose={onClose} role="dialog" aria-labelledby="label">
      <div
        className={css`
          position: relative;
          padding: 1.2rem;
          background: #ecf3f2;
          text-align: left;
          font-family: ${primaryFont};
        `}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => runCallbackIfEnterPressed(e, onClose)}
          className={css`
            position: absolute;
            top: 10px;
            right: 15px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 50px;
            height: 30px;
            width: 30px;
          `}
        >
          <CloseIcon />
        </div>
        {getPageAudioFiles.isPending && (
          <div
            className={css`
              margin-top: 40px;
              ${respondToOrLarger.sm} {
                margin-top: 80px;
              }
            `}
          >
            <Spinner variant="medium" />
          </div>
        )}
        {getPageAudioFiles.isError && (
          <div
            className={css`
              margin-top: 40px;
              ${respondToOrLarger.sm} {
                margin-top: 80px;
              }
            `}
          >
            <ErrorBanner variant="readOnly" error={getPageAudioFiles.error} />
          </div>
        )}
        <div>
          <div
            className={css`
              margin-bottom: 1rem;
            `}
          >
            <h4
              className={css`
                padding-bottom: 5px;
                font-weight: 600;
              `}
            >
              {t("audio-upload")}
            </h4>
            <span
              className={css`
                color: #333;
                font-weight: 500;
                font-family: ${primaryFont};
              `}
            >
              {t("audio-upload-description")}
            </span>
          </div>
          {getPageAudioFiles.isSuccess && (
            <div>
              {getPageAudioFiles.data.map((item) => {
                return (
                  <div
                    key={item.id}
                    className={css`
                      height: 40px;
                      display: flex;
                      gap: 10px 0;
                      align-items: center;
                    `}
                  >
                    <div
                      className={css`
                        background: #fff;
                        font-weight: 500;
                        display: inline-block;
                        justify-content: center;
                        align-items: center;
                        padding: 6px;
                      `}
                    >
                      {item.mime_type}
                    </div>
                    <div
                      className={css`
                        background: #fff;
                        padding: 6px 8px;
                        margin-left: 5px;
                        overflow: hidden;
                        justify-content: center;
                        align-items: center;
                      `}
                    >
                      <TrashIcon
                        className={css`
                          background: #fff;
                        `}
                        onClick={() => {
                          deletePageAudioFile.mutate(item.id)
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <form
            onSubmit={handleUpload}
            method="POST"
            encType="multipart/form-data"
            className={css`
              margin-top: 20px;
              border: 1px solid #555;
              background: #fff;
              display: flex;
              width: 85%;

              input[type="file"] {
                width: 350px;
                max-width: 100%;
                color: #444;
                background: #fff;
                border-radius: 2px;
              }

              input[type="file"]::file-selector-button {
                margin-right: 20px;
                border: none;
                border-right: 1px solid #555;
                padding: 10px 20px;
                color: #333;
                background: #fff;
                cursor: pointer;
                transition: background 0.2s ease-in-out;
              }

              input[type="submit"] {
                border: none;
                background: #555;
                padding: 3px 20px;
                color: #fff;
                cursor: pointer;
                margin: 3px 3px 3px auto;
                transition: background 0.2s ease-in-out;
              }

              input[type="file"]::file-selector-button:hover {
                background: #e1e5ef;
              }
            `}
          >
            <input id="audioFile" name="audioFile" type="file"></input>
            <input type="submit" value={t("upload")} />
          </form>
        </div>
        <button
          className={css`
            background: #fff;
            padding: 4px 20px;
            border: 2px solid #555;
            color: #555;
            cursor: pointer;
            transition: background 0.2s ease-in-out;
            margin-top: 20px;
            width: 80px;
          `}
          onClick={onClose}
        >
          {t("close")}
        </button>
      </div>
    </Dialog>
  )
}

export default PageAudioWidget
