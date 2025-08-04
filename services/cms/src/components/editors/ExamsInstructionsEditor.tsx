import { BlockInstance } from "@wordpress/blocks"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { allowedExamInstructionsCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"

import { ExamInstructions, ExamInstructionsUpdate } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"

interface ExamsInstructionsEditorProps {
  data: ExamInstructions
  handleSave: (updatedTemplate: ExamInstructionsUpdate) => Promise<ExamInstructions>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const ExamsInstructionsGutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

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
