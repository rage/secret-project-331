import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { blockTypeMapForResearchConsentForm } from "../../blocks"
import { allowedResearchFormCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { NewResearchForm, ResearchForm } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import Spinner from "../../shared-module/components/Spinner"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import SerializeGutenbergModal from "../SerializeGutenbergModal"

interface ResearchFormEditorProps {
  data: ResearchForm
  handleSave: (updatedTemplate: NewResearchForm) => Promise<ResearchForm>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const ResearchFormEditor: React.FC<React.PropsWithChildren<ResearchFormEditorProps>> = ({
  data,
  handleSave,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const { t } = useTranslation()

  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks((data.content ?? []) as BlockInstance[], [
      ...allowedResearchFormCoreBlocks,
      // eslint-disable-next-line i18next/no-literal-string
      "moocfi/research-consent-checkbox",
    ]) as BlockInstance[],
  )
  const courseId = useContext(CourseContext)?.courseId
  const [saving, setSaving] = useState(false)
  const [currentContent, setCurrentContent] = useState<BlockInstance[]>(
    modifyBlocks((data.content ?? []) as BlockInstance[], [
      ...allowedResearchFormCoreBlocks,
      // eslint-disable-next-line i18next/no-literal-string
      "moocfi/research-consent-checkbox",
    ]) as BlockInstance[],
  )

  if (!currentContent) {
    if (!isBlockInstanceArray(data.content)) {
      throw new Error("content is not block instance")
    } else {
      setCurrentContent(data.content)
    }
  }

  const handleOnSave = async () => {
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
          justify-content: center;
          background: #f5f6f7;
          padding: 1rem;
        `}
      >
        <Button
          variant="primary"
          size="medium"
          className={css`
            margin-right: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={handleOnSave}
          disabled={saving}
        >
          {t("save")}
        </Button>
        <Button
          variant="secondary"
          size="medium"
          className={css`
            margin-left: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={() => {
            const res = confirm(t("are-you-sure-you-want-to-discard-changes"))
            if (res) {
              setContent(currentContent)
            }
          }}
          disabled={saving}
        >
          {t("reset")}
        </Button>
      </div>
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
function isBlockInstanceArray(obj: unknown): obj is BlockInstance[] {
  if (!Array.isArray(obj)) {
    return false
  }
  for (const o of obj) {
    if (typeof o.name !== "string" || typeof o.clientId !== "string") {
      return false
    }
  }
  return true
}
export default ResearchFormEditor
