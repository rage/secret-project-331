import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import { useRouter } from "next/router"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  fetchPageAudioFiles,
  postPageAudioFile,
  removePageAudioFile,
} from "../../services/backend/pages"
import { PageAudioFile } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import { baseTheme, headingFont } from "../../shared-module/styles"
import { respondToOrLarger } from "../../shared-module/styles/respond"

export interface AudioUploadAttributes {
  src: string | null
}

// const ALLOWED_NESTED_BLOCKS = ["core/audio"]

// const TABLE_TEMPLATE: Template[] = [["core/audio", { title: "UploadAudio block" }]]

const AudioEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<AudioUploadAttributes>>
> = () => {
  const { t } = useTranslation()
  const [audioFile, setAudioFile] = useState<PageAudioFile | null>(null)

  const router = useRouter()
  const pageId = router.asPath.split("/")[2]

  const getPageAudioFiles = useQuery([`page-${pageId}-audio-files`], () =>
    fetchPageAudioFiles(pageId),
  )

  // const deletePageAudioFile = useQuery([`remove-page-${fileId}-audio-files`], () =>
  //   removePageAudioFile(fileId),
  // )

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
        // onClose()
      },
    },
  )

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
    <div>
      {/* {getPageAudioFiles.isLoading && (
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
                    deletePageAudioFile(item.id)
                  }}
                >
                  {t("delete")}
                </Button>
              </div>
            )
          })}
        </div>
      )} */}
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
          text-align: center;
          font-family: ${headingFont};
        `}
      >
        <div>
          <h4>{t("audio-upload")}</h4>
          <span
            className={css`
              color: #333;
              text-align: center;
              font-weight: 600;
              font-family: ${headingFont};
            `}
          >
            {t("audio-upload-description")}
          </span>
        </div>
        {/* <InnerBlocks
        allowedBlocks={ALLOWED_NESTED_BLOCKS}
        template={TABLE_TEMPLATE}
        // eslint-disable-next-line i18next/no-literal-string
        templateLock="all"
      /> */}
        <input id="audioFileChooser" type="file" onChange={handleUpload}></input>
      </form>
    </div>
  )
}

export default AudioEditor
