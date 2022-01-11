/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import SaveIcon from "@material-ui/icons/Save"
import LoadingButton from "@material-ui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useReducer, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { UseMutationResult } from "react-query"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EditorContentDispatch, editorContentReducer } from "../../contexts/EditorContentContext"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { CmsPageUpdate, ContentManagementPage, Page } from "../../shared-module/bindings"
import DebugModal from "../../shared-module/components/DebugModal"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import SuccessNotification from "../../shared-module/components/Notifications/Success"
import Spinner from "../../shared-module/components/Spinner"
import { cmsNormalWidthCenteredComponentStyles } from "../../styles/EditorStyles"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import { denormalizeDocument, normalizeDocument } from "../../utils/documentSchemaProcessor"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

interface PageEditorProps {
  data: Page
  saveMutation: UseMutationResult<ContentManagementPage, unknown, CmsPageUpdate, unknown>
}

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const supportedBlocks = (chapter_id: string | null, exam_id: string | null): string[] => {
  const supportedBlocksForPages: string[] = blockTypeMapForPages.map((mapping) => mapping[0])
  const supportedBlocksTopLevelPages: string[] = blockTypeMapForTopLevelPages.map(
    (mapping) => mapping[0],
  )

  const allSupportedBlocks =
    chapter_id || exam_id
      ? supportedCoreBlocks.concat(supportedBlocksForPages)
      : supportedCoreBlocks.concat(supportedBlocksTopLevelPages)

  return allSupportedBlocks
}

const PageEditor: React.FC<PageEditorProps> = ({ data, saveMutation }) => {
  const { t } = useTranslation()
  const [title, setTitle] = useState(data.title)
  const [content, contentDispatch] = useReducer(
    editorContentReducer,
    modifyBlocks(
      data.content as BlockInstance[],
      supportedBlocks(data.chapter_id, data.exam_id),
    ) as BlockInstance[],
  )

  const currentContentStateSaved = data.content === content

  const handleOnSave = async () => {
    saveMutation.mutate(
      normalizeDocument(
        data.id,
        removeUnsupportedBlockType(content),
        title,
        data.url_path,
        data.chapter_id,
      ),
      {
        onSuccess: (data) => {
          contentDispatch({ type: "setContent", payload: denormalizeDocument(data) })
        },
      },
    )
  }

  let mediaUpload
  if (data.course_id) {
    mediaUpload = mediaUploadBuilder({ courseId: data.course_id })
  } else if (data.exam_id) {
    mediaUpload = mediaUploadBuilder({ examId: data.exam_id })
  } else {
    throw "The backend should ensure that a page is associated with either a course or an exam"
  }

  return (
    <EditorContentDispatch.Provider value={contentDispatch}>
      <div className="editor__component">
        <div className={cmsNormalWidthCenteredComponentStyles}>
          {saveMutation.isError && <ErrorBanner variant={"text"} error={saveMutation.error} />}
          <LoadingButton
            // eslint-disable-next-line i18next/no-literal-string
            loadingPosition="start"
            startIcon={<SaveIcon />}
            loading={saveMutation.isLoading}
            onClick={handleOnSave}
          >
            {/* TODO: This doesn't work? */}
            {currentContentStateSaved ? t("saved") : t("save")}
          </LoadingButton>

          <UpdatePageDetailsForm title={title} setTitle={setTitle} />
        </div>
      </div>
      <div className={cmsNormalWidthCenteredComponentStyles}>
        <GutenbergEditor
          content={content}
          onContentChange={(value) => contentDispatch({ type: "setContent", payload: value })}
          customBlocks={
            data.chapter_id !== null || data.exam_id !== null
              ? blockTypeMapForPages
              : blockTypeMapForTopLevelPages
          }
          allowedBlocks={supportedCoreBlocks}
          allowedBlockVariations={allowedBlockVariants}
          mediaUpload={mediaUpload}
        />
      </div>
      <div className="editor__component">
        <div
          className={css`
            ${cmsNormalWidthCenteredComponentStyles}
            margin-top: 1rem;
            margin-bottom: 1rem;
          `}
        >
          <div
            className={css`
              margin-bottom: 0.5rem;
            `}
          >
            <SerializeGutenbergModal content={content} />
          </div>
          <DebugModal
            data={content}
            readOnly={true}
            updateDataOnClose={(data) => contentDispatch({ type: "setContent", payload: data })}
          />
        </div>
      </div>
    </EditorContentDispatch.Provider>
  )
}
export default PageEditor
