import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { allowedExamInstructionsCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { ExamInstructions, ExamInstructionsUpdate } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import Spinner from "../../shared-module/components/Spinner"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"

interface ExamsInstructionsEditorProps {
  data: ExamInstructions
  handleSave: (updatedTemplate: ExamInstructionsUpdate) => Promise<ExamInstructions>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const EditorLoading = <Spinner variant="medium" />

const ExamsInstructionsGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const ExamsInstructionsEditor: React.FC<React.PropsWithChildren<ExamsInstructionsEditorProps>> = ({
  data,
  handleSave,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
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
          <Button variant="primary" size="medium" disabled={saving} onClick={handleOnSave}>
            {t("save")}
          </Button>
        </div>
      </div>

      <ExamsInstructionsGutenbergEditor
        content={content}
        onContentChange={setContent}
        allowedBlocks={allowedExamInstructionsCoreBlocks}
        mediaUpload={mediaUploadBuilder({ examId: data.id })}
        needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
        setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
      />
    </>
  )
}
export default ExamsInstructionsEditor
