import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { BlockEditProps, Template } from "@wordpress/blocks"
import { useRouter } from "next/router"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  fetchPageAudioFiles,
  postPageAudioFile,
  removePageAudioFile,
} from "../../../../../../../services/backend/pages"
import { PageAudioFile } from "../../../../../../../shared-module/bindings"
import Button from "../../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../../shared-module/components/Spinner"
import useToastMutation from "../../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, headingFont, primaryFont } from "../../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../../shared-module/styles/respond"

export interface AudioUploadAttributes {
  id: string | null
  open: boolean
  onClose: () => void
}

const PageAudioWidget: React.FC<React.PropsWithChildren<BlockEditProps<AudioUploadAttributes>>> = ({
  id,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  const pageId = id

  const getPageAudioFiles = useQuery([`page-${pageId}-audio-files`], () =>
    fetchPageAudioFiles(pageId),
  )

  const deletePageAudioFile = useToastMutation(
    (fileId: string) => removePageAudioFile(fileId),
    {
      notify: true,
      successMessage: t("audio-addedd-successfully"),
      method: "DELETE",
    },
    {
      onSuccess: () => {
        getPageAudioFiles.refetch()
        onClose()
      },
    },
  )

  const uploadAudioFileMutation = useToastMutation(
    (file: File) => postPageAudioFile(pageId, file),
    {
      notify: true,
      successMessage: t("audio-addedd-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        getPageAudioFiles.refetch()
        onClose()
      },
    },
  )

  console.log("pageId", id)

  // const postPageAudio = useQuery([`page-audio-${pageId}`], () =>
  //   pageId ? fetchPageAudioFiles(pageId) : [],
  // )

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return
    }
    const file: File | null = event.target.files[0]
    // const url = URL.createObjectURL(file)
    const isNotAcceptedFormat = file.type !== "audio/mpeg" && file.type !== "audio/ogg"
    // const blob = window.URL || window.webkitURL

    // if (!blob) {
    //   console.log("Your browser does not support Blob URLs :(")
    //   return
    // }

    if (isNotAcceptedFormat) {
      console.log("UNACCEPTED AUDIO TYPES")
    }
    console.log("files", file)
    console.log("e", event)
    uploadAudioFileMutation.mutate(file)
  }

  return (
    <Dialog open={open} onClose={onClose} role="dialog" aria-labelledby="label">
      <div>
        {getPageAudioFiles.isLoading && (
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
        {getPageAudioFiles.isSuccess && (
          <div>
            {getPageAudioFiles.data.map((item) => {
              return (
                <div key={item.id}>
                  <div>{item.id}</div>
                  <Button
                    size="medium"
                    variant="secondary"
                    onClick={() => {
                      deletePageAudioFile.mutate(item.id)
                    }}
                  >
                    {t("delete")}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        <form
          onChange={(value) => {
            console.log("value", value.target)
            // const isAcceptedFormat = value
            // if (!isAcceptedFormat) {
            //   // empty
            //   setAttributes({ src: undefined })
            //   return
            // }
            // setAttributes({ src: isAcceptedFormat })
          }}
          className={css`
            padding: 1rem;
            background: #ecf3f2;
            text-align: left;
            font-family: ${primaryFont};
          `}
        >
          <div
            className={css`
              margin-bottom: 1rem;
            `}
          >
            <h4
              className={css`
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
          <div>
            <input id="audioFile" name="audioFile" type="file" onChange={handleUpload}></input>
          </div>
          <input type="submit" value="Upload" />
          <input type="submit" value="Close" onClick={onClose} />
        </form>
      </div>
    </Dialog>
  )
}

export default PageAudioWidget
