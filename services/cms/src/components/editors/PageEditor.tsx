import { css } from "@emotion/css"
import SaveIcon from "@material-ui/icons/Save"
import LoadingButton from "@material-ui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { Page, PageUpdate } from "../../shared-module/bindings"
import DebugModal from "../../shared-module/components/DebugModal"
import Spinner from "../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

interface PageEditorProps {
  data: Page
  handleSave: (page: PageUpdate) => Promise<Page>
}

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const supportedBlocks = (chapter_id: string | null): string[] => {
  const supportedBlocksForPages: string[] = blockTypeMapForPages.map((mapping) => mapping[0])
  const supportedBlocksTopLevelPages: string[] = blockTypeMapForTopLevelPages.map(
    (mapping) => mapping[0],
  )

  const allSupportedBlocks = chapter_id
    ? supportedCoreBlocks.concat(supportedBlocksForPages)
    : supportedCoreBlocks.concat(supportedBlocksTopLevelPages)

  return allSupportedBlocks
}

const PageEditor: React.FC<PageEditorProps> = ({ data, handleSave }) => {
  const { t } = useTranslation()
  const [title, setTitle] = useState(data.title)
  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks(
      data.content as BlockInstance[],
      supportedBlocks(data.chapter_id),
    ) as BlockInstance[],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentContentStateSaved = data.content === content

  const handleOnSave = async () => {
    setSaving(true)
    try {
      const res = await handleSave({
        title,
        url_path: data.url_path,
        content: removeUnsupportedBlockType(content),
        chapter_id: data.chapter_id,
      })
      setError(null)
      setContent(res.content as BlockInstance[])
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        throw e
      }
      setError(e.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="editor__component">
        <div className={normalWidthCenteredComponentStyles}>
          {error && <pre>{error}</pre>}
          <LoadingButton
            // eslint-disable-next-line i18next/no-literal-string
            loadingPosition="start"
            startIcon={<SaveIcon />}
            loading={saving}
            onClick={handleOnSave}
          >
            {currentContentStateSaved ? t("saved") : t("save")}
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
      <div className="editor__component">
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
