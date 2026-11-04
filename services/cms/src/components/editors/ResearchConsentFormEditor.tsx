"use client"

import { css } from "@emotion/css"
import React, { useContext, useEffect, useRef, useState } from "react"

import type { NewResearchForm, ResearchForm } from "@/generated/api"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import type { ResearchFormPreviewMessage } from "@/shared-module/common/utils/researchFormPreview"
import { openResearchFormPreviewChannel } from "@/shared-module/common/utils/researchFormPreview"
import { manageCourseResearchFormPreviewRoute } from "@/shared-module/common/utils/routes"
import { Button, ErrorNotice, useDialog } from "@/shared-module/components"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { blockTypeMapForResearchConsentForm } from "../../blocks"
import { isResearchQuestionTooShort } from "../../blocks/ResearchConsentQuestion/questionLength"
import { allowedResearchFormCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import { mediaUploadBuilder } from "../../services/mediaUpload"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import SerializeGutenbergModal from "../SerializeGutenbergModal"

// oxlint-disable-next-line i18next/no-literal-string
const QUESTION_BLOCK_NAME = "moocfi/research-consent-question"

interface ResearchFormEditorProps {
  initialContent: BlockInstance[]
  handleSave: (updatedTemplate: NewResearchForm) => Promise<ResearchForm>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const GutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

const ResearchFormEditor: React.FC<React.PropsWithChildren<ResearchFormEditorProps>> = ({
  initialContent,
  handleSave,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const [content, setContent] = useState<BlockInstance[]>(() =>
    modifyBlocks(initialContent, [...allowedResearchFormCoreBlocks, QUESTION_BLOCK_NAME]),
  )
  const courseId = useContext(CourseContext)?.courseId
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState<BlockInstance[]>(content)

  const latestContent = useRef(content)
  const previewChannel = useRef<BroadcastChannel | null>(null)
  useEffect(() => {
    if (!courseId) {
      return
    }
    const channel = openResearchFormPreviewChannel(courseId)
    channel.addEventListener("message", (event: MessageEvent<ResearchFormPreviewMessage>) => {
      if (event.data.type === "ready") {
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel has no target origin
        channel.postMessage(previewDraft(latestContent.current))
      }
    })
    previewChannel.current = channel
    return () => {
      channel.close()
      previewChannel.current = null
    }
  }, [courseId])
  useEffect(() => {
    latestContent.current = content
    previewChannel.current?.postMessage(previewDraft(content))
  }, [content])

  const handleOnSave = async () => {
    const questions = content.filter((block) => block.name === QUESTION_BLOCK_NAME)
    if (questions.length === 0) {
      setSaveError(t("research-form-needs-a-question"))
      return
    }
    if (questions.some((question) => isResearchQuestionTooShort(question.attributes.content))) {
      setSaveError(t("research-form-has-too-short-questions"))
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const res = await handleSave({
        content: removeUnsupportedBlockType(content),
        course_id: assertNotNullOrUndefined(courseId),
      })
      setContent(res.content as BlockInstance[])
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        throw e
      }
    } finally {
      setSaving(false)
      setCurrentContent(content)
    }
  }
  const saveAndReset = (
    <div>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: var(--space-3);
          background: #f5f6f7;
          padding: 1rem;
          /* Gutenberg's own stylesheet loads last and can disable pointer events on the inspector. */
          pointer-events: auto;
        `}
      >
        <Button variant="primary" size="medium" onClick={handleOnSave} disabled={saving}>
          {t("save")}
        </Button>
        {courseId && (
          <Button
            variant="secondary"
            size="medium"
            onClick={() => window.open(manageCourseResearchFormPreviewRoute(courseId), "_blank")}
          >
            {t("preview")}
          </Button>
        )}
        <Button
          variant="secondary"
          size="medium"
          onClick={async () => {
            const res = await confirm({
              message: t("are-you-sure-you-want-to-discard-changes"),
              isDestructive: true,
            })
            if (res) {
              setContent(currentContent)
            }
          }}
          disabled={saving}
        >
          {t("reset")}
        </Button>
      </div>
      {saveError && <ErrorNotice error={saveError} />}
    </div>
  )
  return (
    <>
      <BreakFromCentered sidebar={false}>
        <div className="editor__top-button-wrapper">{saveAndReset}</div>
      </BreakFromCentered>

      <div>
        {courseId && (
          <GutenbergEditor
            content={content}
            onContentChange={setContent}
            allowedBlocks={allowedResearchFormCoreBlocks}
            customBlocks={blockTypeMapForResearchConsentForm}
            mediaUpload={mediaUploadBuilder({ courseId: courseId })}
            needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
            setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
            inspectorButtons={saveAndReset}
          />
        )}
      </div>
      <div className="editor__component">
        <div
          className={css`
            margin-top: 1rem;
            margin-bottom: 1rem;
          `}
        >
          <div
            className={css`
              margin-bottom: 0.5rem;
            `}
          >
            <SerializeGutenbergModal content={content} />
          </div>
        </div>
      </div>
    </>
  )
}

/** What Save would store, as plain JSON: RichText values are objects until serialized. */
function previewDraft(content: BlockInstance[]): ResearchFormPreviewMessage {
  return {
    type: "draft",
    content: JSON.parse(JSON.stringify(removeUnsupportedBlockType(content))),
  }
}

export default ResearchFormEditor
