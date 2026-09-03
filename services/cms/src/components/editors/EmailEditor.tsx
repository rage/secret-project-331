"use client"

import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import type { EmailTemplate, EmailTemplateUpdate } from "@/generated/api"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { Button } from "@/shared-module/components"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import { mediaUploadBuilder } from "../../services/mediaUpload"
import type { MediaUploadProps } from "../../services/mediaUpload"
import { extractPlaceholders, validatePlaceholders } from "../../utils/emailPlaceholders"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import type { EmailDetailsFormFields } from "../forms/UpdateEmailDetailsForm"
import UpdateEmailDetailsForm, {
  SUBJECT_FIELD_NAME,
  TEMPLATE_TYPE_FIELD_NAME,
} from "../forms/UpdateEmailDetailsForm"

interface EmailEditorProps {
  data: EmailTemplate
  saveMutation: UseMutationResult<EmailTemplate, unknown, EmailTemplateUpdate, unknown>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const EmailGutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

const EmailEditor: React.FC<React.PropsWithChildren<EmailEditorProps>> = ({
  data,
  saveMutation,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const courseId = useContext(CourseContext)?.courseId
  const { t } = useTranslation()

  const normalizeBlocks = useCallback((blocks: unknown[]): BlockInstance[] => {
    return blocks.map((block) => {
      const blockObj = block as Record<string, unknown>
      const normalized = { ...blockObj }
      if (blockObj.type && !blockObj.name) {
        normalized.name = blockObj.type
        delete normalized.type
      }
      if (normalized.innerBlocks && Array.isArray(normalized.innerBlocks)) {
        normalized.innerBlocks = normalizeBlocks(normalized.innerBlocks)
      }
      return normalized as unknown as BlockInstance
    })
  }, [])

  const [content, setContent] = useState<BlockInstance[]>(() => {
    const normalizedBlocks = normalizeBlocks((data.content ?? []) as unknown[])
    const initialContent = modifyBlocks(normalizedBlocks, allowedEmailCoreBlocks) as BlockInstance[]
    return initialContent
  })
  const { control: emailDetailsControl, reset: resetEmailDetailsForm } =
    useForm<EmailDetailsFormFields>({
      defaultValues: {
        templateType: data.template_type,
        subject: data.subject ?? "",
      },
    })
  const templateTypeString = useWatch({
    control: emailDetailsControl,
    name: TEMPLATE_TYPE_FIELD_NAME,
  })
  const subject = useWatch({ control: emailDetailsControl, name: SUBJECT_FIELD_NAME })

  const detectedPlaceholders = useMemo(() => extractPlaceholders(content), [content])
  const placeholderValidation = useMemo(() => {
    if (templateTypeString === "generic") {
      return {
        valid: true,
        errors: [],
        warnings: [],
        detectedPlaceholders,
        missingRequired: [],
        invalidPlaceholders: [],
      }
    }
    return validatePlaceholders(templateTypeString, detectedPlaceholders)
  }, [templateTypeString, detectedPlaceholders])

  const dataContentString = useMemo(() => JSON.stringify(data.content), [data.content])
  const dataTemplateType = data.template_type

  useEffect(() => {
    const contentToUse = data.content ?? []
    const normalizedBlocks = normalizeBlocks(contentToUse as unknown[])
    const modifiedContent = modifyBlocks(
      normalizedBlocks,
      allowedEmailCoreBlocks,
    ) as BlockInstance[]
    setContent(modifiedContent)
    resetEmailDetailsForm({ templateType: dataTemplateType, subject: data.subject ?? "" })
    setNeedToRunMigrationsAndValidations(true)
  }, [
    dataContentString,
    dataTemplateType,
    data.subject,
    data.content,
    setNeedToRunMigrationsAndValidations,
    normalizeBlocks,
    resetEmailDetailsForm,
  ])

  useEffect(() => {
    if (saveMutation.isSuccess && saveMutation.data) {
      setContent((saveMutation.data.content ?? []) as BlockInstance[])
      resetEmailDetailsForm({
        templateType: saveMutation.data.template_type,
        subject: saveMutation.data.subject ?? "",
      })
    }
  }, [saveMutation.isSuccess, saveMutation.data, resetEmailDetailsForm])

  const handleOnSave = () => {
    if (!placeholderValidation.valid) {
      return
    }

    saveMutation.mutate(
      {
        subject,
        template_type: templateTypeString,
        content: removeUnsupportedBlockType(content),
        exercise_completions_threshold: null,
        points_threshold: null,
      } as unknown as EmailTemplateUpdate,
      {
        onSuccess: (res) => {
          setContent((res.content ?? []) as BlockInstance[])
          resetEmailDetailsForm({ templateType: res.template_type, subject: res.subject ?? "" })
        },
      },
    )
  }

  const saveButton = (
    <div
      className={css`
        display: flex;
        justify-content: center;
        background: #f5f6f7;
        padding: 1rem;
      `}
    >
      <Button
        variant="primary"
        size="medium"
        className={css`
          border: 1px black solid;
          pointer-events: auto;
        `}
        onClick={handleOnSave}
        disabled={saveMutation.isPending || !placeholderValidation.valid}
      >
        {t("save")}
      </Button>
    </div>
  )

  return (
    <>
      <div className="editor__component">
        <div
          className={css`
            padding: 1rem;
            max-width: 1200px;
            margin: 0 auto;
          `}
        >
          {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}

          <UpdateEmailDetailsForm
            control={emailDetailsControl}
            templateType={templateTypeString}
            placeholderValidation={placeholderValidation}
          />
        </div>
      </div>

      <EmailGutenbergEditor
        content={content}
        onContentChange={setContent}
        allowedBlocks={allowedEmailCoreBlocks}
        mediaUpload={
          courseId
            ? mediaUploadBuilder({ courseId: courseId })
            : // oxlint-disable-next-line eslint/require-await -- async to match the mediaUpload prop's Promise type
              async (props: MediaUploadProps) => {
                // oxlint-disable-next-line i18next/no-literal-string
                const errorMessage = "Media uploads are not available for global email templates"
                console.warn(errorMessage)
                props.onError(errorMessage)
              }
        }
        inspectorButtons={saveButton}
        needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
        setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
      />
    </>
  )
}
export default EmailEditor
