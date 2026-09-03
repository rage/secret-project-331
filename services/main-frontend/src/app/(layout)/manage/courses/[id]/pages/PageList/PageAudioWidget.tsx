"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  deletePageAudioFileMutation as deletePageAudioFileMutationOptions,
  getPageAudioFilesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { createPageAudioFile } from "@/generated/api/sdk.generated"
import TrashIcon from "@/imgs/trash.svg"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { primaryFont } from "@/shared-module/common/styles"
import { Dialog, FileField, QueryResult } from "@/shared-module/components"

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

interface AudioUploadFields {
  audioFile: File[]
}

const PageAudioWidgetContent: React.FC<PageAudioWidgetContentProps> = ({ pageId }) => {
  const { t } = useTranslation()
  const { control, handleSubmit, reset } = useForm<AudioUploadFields>({
    defaultValues: { audioFile: [] },
  })
  // FileField's chosen-file summary is internal display state that isn't driven by the RHF value,
  // so remounting is the only way to clear it back to "no file chosen" after a successful upload.
  const [resetKey, setResetKey] = useState(0)
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

  const handleUpload = handleSubmit(({ audioFile }) => {
    const file = audioFile[0]
    if (!file) {
      return
    }
    if (!ACCEPTABLE_MIME_TYPES.includes(file.type)) {
      console.error("The audio format is not accepted")
      throw new Error("The audio format is not accepted")
    }
    uploadAudioFileMutation.mutate(file)
    reset()
    setResetKey((key) => key + 1)
  })

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
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 12px;
            width: 85%;

            input[type="submit"] {
              border: none;
              background: #555;
              padding: 3px 20px;
              color: #fff;
              cursor: pointer;
              transition: background 0.2s ease-in-out;
            }
          `}
        >
          <FileField
            key={resetKey}
            control={control}
            name="audioFile"
            label={t("audio-upload")}
            accept={ACCEPTABLE_MIME_TYPES.join(",")}
          />
          <input type="submit" value={t("upload")} />
        </form>
      </div>
    </div>
  )
}

const audioDialogCss = css`
  background: #ecf3f2;
`

const PageAudioWidget: React.FC<React.PropsWithChildren<AudioUploadAttributes>> = ({
  id,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t("audio-upload")} className={audioDialogCss}>
      {id ? <PageAudioWidgetContent pageId={id} /> : null}
    </Dialog>
  )
}

export default PageAudioWidget
