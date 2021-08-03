import { css } from "@emotion/css"
import SaveIcon from "@material-ui/icons/Save"
import LoadingButton from "@material-ui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { Page, PageUpdate } from "../../shared-module/bindings"
import DebugModal from "../../shared-module/components/DebugModal"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

import { giveSpaceToSidebarStyles } from "./GutenbergEditor"

interface PageEditorProps {
  data: Page
  handleSave: (page: PageUpdate) => Promise<Page>
}

const EditorLoading = <div>Loading editor...</div>

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const PageEditor: React.FC<PageEditorProps> = ({ data, handleSave }) => {
  const [title, setTitle] = useState(data.title)
  const [content, setContent] = useState<BlockInstance[]>(data.content as BlockInstance[])
  const [saving, setSaving] = useState(false)

  const currentContentStateSaved = data.content === content

  const handleOnSave = async () => {
    setSaving(true)
    const res = await handleSave({
      title,
      url_path: data.url_path,
      content,
      chapter_id: data.chapter_id,
      front_page_of_chapter_id: null,
    })
    setContent(res.content as BlockInstance[])
    setSaving(false)
  }

  return (
    <>
      <div className={giveSpaceToSidebarStyles}>
        <div className={normalWidthCenteredComponentStyles}>
          <LoadingButton
            loadingPosition="start"
            startIcon={<SaveIcon />}
            loading={saving}
            onClick={handleOnSave}
          >
            {currentContentStateSaved ? "Saved" : "Save"}
          </LoadingButton>

          <UpdatePageDetailsForm title={title} setTitle={setTitle} />
        </div>
      </div>
      {data.chapter_id !== null ? (
        <GutenbergEditor
          content={content}
          onContentChange={setContent}
          customBlocks={blockTypeMapForPages}
          allowedBlocks={supportedCoreBlocks}
          allowedBlockVariations={allowedBlockVariants}
        />
      ) : (
        <GutenbergEditor
          content={content}
          onContentChange={setContent}
          customBlocks={blockTypeMapForTopLevelPages}
          allowedBlocks={supportedCoreBlocks}
          allowedBlockVariations={allowedBlockVariants}
        />
      )}
      <div className={giveSpaceToSidebarStyles}>
        <div
          className={css`
            ${normalWidthCenteredComponentStyles}

            margin-top: 1rem;
            margin-bottom: 1rem;
          `}
        >
          <SerializeGutenbergModal content={content} />
          <DebugModal data={content} />
        </div>
      </div>
    </>
  )
}
export default PageEditor
