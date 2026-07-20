"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  deletePageAudioFileMutation as deletePageAudioFileMutationOptions,
  getPageAudioFilesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { createPageAudioFile } from "@/generated/api/sdk.generated"
import TrashIcon from "@/imgs/trash.svg"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { primaryFont } from "@/shared-module/common/styles"
import { QueryResult } from "@/shared-module/components"

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

interface PageAudioWidgetContentProps {
  pageId: string
}

const PageAudioWidgetContent: React.FC<PageAudioWidgetContentProps> = ({ pageId }) => {
  const { t } = useTranslation()
  const pageAudioFilesQuery = useQuery(
    getPageAudioFilesOptions({
      path: {
        page_id: pageId,
      },
    }),
  )

  const deletePageAudioFile = useToastMutationOptions(
    deletePageAudioFileMutationOptions(),
    {
      notify: true,
      successMessage: t("audio-deleted-successfully"),
      method: "DELETE",
    },
    {
      onSuccess: () => {
        pageAudioFilesQuery.refetch()
      },
    },
  )

  const uploadAudioFileMutation = useToastMutation(
    (file: File) =>
      createPageAudioFile({
        path: {
          page_id: pageId,
        },
        body: {
          file: file as unknown as number[],
        },
      }),
    {
      notify: true,
      successMessage: t("audio-added-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        pageAudioFilesQuery.refetch()
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
    <div
      className={css`
        text-align: left;
        font-family: ${primaryFont};
      `}
    >
      <div>
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
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
        <QueryResult query={pageAudioFilesQuery}>
          {(data) => (
            <div>
              {data.map((item) => {
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
                          deletePageAudioFile.mutate({
                            path: {
                              file_id: item.id,
                            },
                          })
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </QueryResult>
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
    </div>
  )
}

const PageAudioWidget: React.FC<React.PropsWithChildren<AudioUploadAttributes>> = ({
  id,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={t("audio-upload")}
      width="normal"
      backgroundColor="#ecf3f2"
    >
      {id ? <PageAudioWidgetContent pageId={id} /> : null}
    </StandardDialog>
  )
}

export default PageAudioWidget
