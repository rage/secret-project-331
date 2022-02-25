/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import { isEqual } from "lodash"
import dynamic from "next/dynamic"
import React, { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { UseMutationResult } from "react-query"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EditorContentDispatch, editorContentReducer } from "../../contexts/EditorContentContext"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { CmsPageUpdate, ContentManagementPage, Page } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DebugModal from "../../shared-module/components/DebugModal"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
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
  const savedTitle = data.title
  const savedContent = modifyBlocks(
    data.content as BlockInstance[],
    supportedBlocks(data.chapter_id, data.exam_id),
  ) as BlockInstance[]
  const [content, contentDispatch] = useReducer(
    editorContentReducer,
    modifyBlocks(savedContent, supportedBlocks(data.chapter_id, data.exam_id)) as BlockInstance[],
  )
  const currentContentStateSaved = isEqual(savedContent, content) && savedTitle === title
  const [currentlySaving, setCurrentlySaving] = useState(false)
  const handleOnSave = async () => {
    setCurrentlySaving(true)
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
        onSettled: () => {
          setCurrentlySaving(false)
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
        <div>
          {saveMutation.isError && <ErrorBanner variant={"text"} error={saveMutation.error} />}
          <UpdatePageDetailsForm title={title} setTitle={setTitle} />
        </div>
      </div>
      <div>
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
      <div
        className={`
          ${css`
            position: sticky;
            bottom: 4rem;
            display: flex;
            justify-content: center;
            pointer-events: none;
          `}`}
      >
        <Button
          variant="primary"
          size="medium"
          className={css`
            margin-right: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={handleOnSave}
          disabled={currentContentStateSaved || currentlySaving}
        >
          {t("save")}
        </Button>
        <Button
          variant="secondary"
          size="medium"
          className={css`
            margin-left: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={() => contentDispatch({ type: "setContent", payload: savedContent })}
          disabled={currentContentStateSaved || currentlySaving}
        >
          {t("reset")}
        </Button>
      </div>
      <div className="editor__component">
        <div
          className={css`
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
