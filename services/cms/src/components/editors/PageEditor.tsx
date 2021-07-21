import SaveIcon from "@material-ui/icons/Save"
import LoadingButton from "@material-ui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { Page, PageUpdate } from "../../shared-module/bindings"
import DebugModal from "../../shared-module/components/DebugModal"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

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
  const [urlPath, setUrlPath] = useState(data.url_path)
  const [content, setContent] = useState<BlockInstance[]>(data.content as BlockInstance[])
  const [saving, setSaving] = useState(false)

  const handleOnSave = async () => {
    setSaving(true)
    const res = await handleSave({
      title,
      url_path: urlPath,
      content,
      chapter_id: data.chapter_id,
      front_page_of_chapter_id: null,
    })
    setContent(res.content as BlockInstance[])
    setSaving(false)
  }

  return (
    <>
      <h1>{data.title}</h1>
      <LoadingButton
        loadingPosition="start"
        startIcon={<SaveIcon />}
        loading={saving}
        onClick={handleOnSave}
      >
        Save
      </LoadingButton>

      <UpdatePageDetailsForm
        title={title}
        urlPath={urlPath}
        setTitle={setTitle}
        setUrlPath={setUrlPath}
      />
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

      <SerializeGutenbergModal content={content} />
      <DebugModal data={content} />
    </>
  )
}
export default PageEditor
