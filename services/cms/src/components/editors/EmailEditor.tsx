"use client"

import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"
import React, { useContext, useEffect, useMemo, useState } from "react"

import type {
  EmailTemplate,
  EmailTemplatePreviewRequest,
  EmailTemplateUpdate,
} from "@/generated/api"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { Button, Infobox, TONE } from "@/shared-module/components"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { blockTypeMapForEmails } from "../../blocks"
import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import { mediaUploadBuilder } from "../../services/mediaUpload"
import type { MediaUploadProps } from "../../services/mediaUpload"
import { stripProtocolBeforePlaceholderLinks } from "../../utils/emailPlaceholderLinks"
import { extractPlaceholders, validatePlaceholders } from "../../utils/emailPlaceholders"
import {
  emailEditorAllowedFormats,
  emailEditorRootLayout,
  emailEditorSettings,
} from "../../utils/Gutenberg/emailEditorSettings"
import { findImagesNeedingAltText } from "../../utils/Gutenberg/imageAltWarning"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import EmailPreviewDialog from "../email/EmailPreviewDialog"
import UpdateEmailDetailsForm from "../forms/UpdateEmailDetailsForm"

interface EmailEditorProps {
  data: EmailTemplate
  saveMutation: UseMutationResult<EmailTemplate, unknown, EmailTemplateUpdate, unknown>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const EmailGutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

const allowedEmailBlocks = [
  ...allowedEmailCoreBlocks,
  ...blockTypeMapForEmails.map(([blockName]) => blockName),
]

const imageFileName = (url: unknown): string | null => {
  if (typeof url !== "string") {
    return null
  }
  return url.split(/[?#]/)[0]?.split("/").pop() || null
}

const EmailEditor: React.FC<React.PropsWithChildren<EmailEditorProps>> = ({
  data,
  saveMutation,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const courseId = useContext(CourseContext)?.courseId
  const { t } = useTranslation()

  // The renderer in headless-lms `email_processor.rs` reads these style names.
  /* oxlint-disable i18next/no-literal-string */
  const emailBlockStyles = useMemo(
    () => ({
      "core/paragraph": [
        { name: "default", label: t("block-style-default"), isDefault: true },
        { name: "lead", label: t("email-block-style-lead") },
        { name: "code", label: t("email-block-style-code") },
      ],
      "core/button": [
        { name: "default", label: t("block-style-default"), isDefault: true },
        { name: "arrow", label: t("email-block-style-arrow") },
      ],
      // Their stock variations only add CSS classes the renderer ignores.
      "core/image": [],
      "core/table": [],
      "core/quote": [],
      "core/separator": [],
    }),
    [t],
  )
  /* oxlint-enable i18next/no-literal-string */

  const [content, setContent] = useState<BlockInstance[]>(() => {
    const initialContent = modifyBlocks(
      (data.content ?? []) as BlockInstance[],
      allowedEmailBlocks,
    ) as BlockInstance[]
    return initialContent
  })
  const [templateType, setTemplateType] = useState<unknown>(
    // oxlint-disable-next-line i18next/no-literal-string
    (data as { template_type?: unknown }).template_type ?? "generic",
  )
  const [subject, setSubject] = useState(data.subject ?? "")
  const [previewDraft, setPreviewDraft] = useState<EmailTemplatePreviewRequest | null>(null)

  const templateTypeString = useMemo(() => {
    if (typeof templateType === "string") {
      return templateType
    }
    return templateType as unknown as string
  }, [templateType])

  const detectedPlaceholders = useMemo(
    () => extractPlaceholders(content, subject),
    [content, subject],
  )
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

  const imagesNeedingAltText = useMemo(() => findImagesNeedingAltText(content), [content])
  const canSave = placeholderValidation.valid && imagesNeedingAltText.length === 0

  const dataContentString = useMemo(() => JSON.stringify(data.content), [data.content])
  const dataTemplateType = useMemo(
    // oxlint-disable-next-line i18next/no-literal-string
    () => (data as { template_type?: unknown }).template_type ?? "generic",
    [data],
  )

  useEffect(() => {
    const modifiedContent = modifyBlocks(
      (data.content ?? []) as BlockInstance[],
      allowedEmailBlocks,
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

  const normalizedContent = () =>
    stripProtocolBeforePlaceholderLinks(removeUnsupportedBlockType(content))

  const handleOnSave = () => {
    if (!canSave) {
      return
    }

    saveMutation.mutate(
      {
        subject,
        template_type: templateType,
        content: normalizedContent(),
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
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        background: #f5f6f7;
        padding: 1rem;
      `}
    >
      <Button
        variant="primary"
        size="medium"
        onClick={handleOnSave}
        disabled={!canSave}
        isLoading={saveMutation.isPending}
      >
        {t("save")}
      </Button>
      <Button
        variant="secondary"
        size="medium"
        onClick={() => setPreviewDraft({ subject, content: normalizedContent() })}
      >
        {t("preview")}
      </Button>
      {imagesNeedingAltText.length > 0 && (
        <Infobox tone={TONE.WARNING} heading={t("email-images-need-alt-text")}>
          <ul
            className={css`
              margin: 0;
              padding-left: 1.25rem;
              overflow-wrap: anywhere;
            `}
          >
            {imagesNeedingAltText.map((image) => (
              <li key={image.clientId}>
                {imageFileName(image.attributes?.url) ?? t("email-image-without-file")}
              </li>
            ))}
          </ul>
        </Infobox>
      )}
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
        customBlocks={blockTypeMapForEmails}
        blockStyles={emailBlockStyles}
        allowedFormats={emailEditorAllowedFormats}
        settingsOverrides={emailEditorSettings}
        rootLayout={emailEditorRootLayout}
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
      <EmailPreviewDialog
        emailTemplateId={data.id}
        draft={previewDraft}
        onClose={() => setPreviewDraft(null)}
      />
    </>
  )
}
export default EmailEditor
