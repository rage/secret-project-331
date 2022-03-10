import SaveIcon from "@mui/icons-material/Save"
import LoadingButton from "@mui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { allowedExamInstructionsCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { ExamInstructions, ExamInstructionsUpdate } from "../../shared-module/bindings"
import Spinner from "../../shared-module/components/Spinner"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"

interface ExamsInstructionsEditorProps {
  data: ExamInstructions
  handleSave: (updatedTemplate: ExamInstructionsUpdate) => Promise<ExamInstructions>
}

const EditorLoading = <Spinner variant="medium" />

const ExamsInstructionsGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const ExamsInstructionsEditor: React.FC<ExamsInstructionsEditorProps> = ({ data, handleSave }) => {
  const { t } = useTranslation()
  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks(
      (data.instructions ?? []) as BlockInstance[],
      allowedExamInstructionsCoreBlocks,
    ) as BlockInstance[],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOnSave = async () => {
    setSaving(true)
    try {
      const res = await handleSave({
        instructions: removeUnsupportedBlockType(content),
      })
      setContent(res.instructions as BlockInstance[])
      setError(null)
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
        <div>
          {error && <pre>{error}</pre>}
          <LoadingButton
            // eslint-disable-next-line i18next/no-literal-string
            loadingPosition="start"
            startIcon={<SaveIcon />}
            loading={saving}
            onClick={handleOnSave}
          >
            {t("save")}
          </LoadingButton>
        </div>
      </div>

      <ExamsInstructionsGutenbergEditor
        content={content}
        onContentChange={setContent}
        allowedBlocks={allowedExamInstructionsCoreBlocks}
        mediaUpload={mediaUploadBuilder({ examId: data.id })}
      />
    </>
  )
}
export default ExamsInstructionsEditor
