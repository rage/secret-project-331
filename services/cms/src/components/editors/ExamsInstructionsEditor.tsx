"use client"
import { UseMutationResult } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { allowedExamInstructionsCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"

import { ExamInstructions, ExamInstructionsUpdate } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"

interface ExamsInstructionsEditorProps {
  data: ExamInstructions
  saveMutation: UseMutationResult<ExamInstructions, unknown, ExamInstructionsUpdate, unknown>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const ExamsInstructionsGutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

const ExamsInstructionsEditor: React.FC<React.PropsWithChildren<ExamsInstructionsEditorProps>> = ({
  data,
  saveMutation,
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

  const handleOnSave = () => {
    saveMutation.mutate(
      {
        instructions: removeUnsupportedBlockType(content),
      },
      {
        onSuccess: (res) => {
          setContent(res.instructions as BlockInstance[])
        },
      },
    )
  }

  return (
    <>
      <div className="editor__component">
        <div>
          {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}
          <Button
            variant="primary"
            size="medium"
            disabled={saveMutation.isPending}
            onClick={handleOnSave}
          >
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
