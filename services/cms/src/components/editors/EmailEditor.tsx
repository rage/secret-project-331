"use client"

import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react"

import type { EmailTemplate, EmailTemplateUpdate } from "@/generated/api"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import mediaUploadBuilder from "../../services/mediaUpload"
import type { MediaUploadProps } from "../../services/mediaUpload"
import { extractPlaceholders, validatePlaceholders } from "../../utils/emailPlaceholders"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import UpdateEmailDetailsForm from "../forms/UpdateEmailDetailsForm"

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
  const [templateType, setTemplateType] = useState<unknown>(
    // oxlint-disable-next-line i18next/no-literal-string
    (data as { template_type?: unknown }).template_type ?? "generic",
  )
  const [subject, setSubject] = useState(data.subject ?? "")

  const templateTypeString = useMemo(() => {
    if (typeof templateType === "string") {
      return templateType
    }
    return templateType as unknown as string
  }, [templateType])

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
  const dataTemplateType = useMemo(
    // oxlint-disable-next-line i18next/no-literal-string
    () => (data as { template_type?: unknown }).template_type ?? "generic",
    [data],
  )

  useEffect(() => {
    const contentToUse = data.content ?? []
    const normalizedBlocks = normalizeBlocks(contentToUse as unknown[])
    const modifiedContent = modifyBlocks(
      normalizedBlocks,
      allowedEmailCoreBlocks,
    ) as BlockInstance[]
    setContent(modifiedContent)
    setTemplateType(dataTemplateType)
    setSubject(data.subject ?? "")
    setNeedToRunMigrationsAndValidations(true)
  }, [
    dataContentString,
    dataTemplateType,
    data.subject,
    data.content,
    setNeedToRunMigrationsAndValidations,
    normalizeBlocks,
  ])

  useEffect(() => {
    if (saveMutation.isSuccess && saveMutation.data) {
      setContent((saveMutation.data.content ?? []) as BlockInstance[])

      setTemplateType(
        // oxlint-disable-next-line i18next/no-literal-string
        (saveMutation.data as { template_type?: unknown }).template_type ?? "generic",
      )
      setSubject(saveMutation.data.subject ?? "")
    }
  }, [saveMutation.isSuccess, saveMutation.data])

  const handleOnSave = () => {
    if (!placeholderValidation.valid) {
      return
    }

    saveMutation.mutate(
      {
        subject,
        template_type: templateType,
        content: removeUnsupportedBlockType(content),
        exercise_completions_threshold: null,
        points_threshold: null,
      } as unknown as EmailTemplateUpdate,
      {
        onSuccess: (res) => {
          setContent((res.content ?? []) as BlockInstance[])
          // oxlint-disable-next-line i18next/no-literal-string
          setTemplateType((res as { template_type?: unknown }).template_type ?? "generic")
          setSubject(res.subject ?? "")
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
            templateType={templateType}
            subject={subject}
            setTemplateType={setTemplateType}
            setSubject={setSubject}
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
