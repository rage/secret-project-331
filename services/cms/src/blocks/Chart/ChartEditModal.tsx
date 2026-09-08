"use client"

import { css } from "@emotion/css"
import { Modal } from "@wordpress/components"
import React, { useContext, useRef, useState } from "react"
import { useForm } from "react-hook-form"

import PageContext from "@/contexts/PageContext"
import { TextField } from "@/shared-module/components/components/TextField"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChartAttributes } from "."
import ChartAiPromptStep from "./ChartAiPromptStep"
import ChartDataFileSection from "./ChartDataFileSection"
import ChartDataStep from "./ChartDataStep"
import ChartMethodStep from "./ChartMethodStep"
import ChartPreviewPane from "./ChartPreviewPane"
import { specIsValidJson } from "./chartSpec"
import { useChartCaptionField } from "./useChartCaptionField"
import { useChartDataFile } from "./useChartDataFile"
import {
  STEP_AI,
  STEP_DATA,
  STEP_EDITOR,
  STEP_METHOD,
  useChartEditorStep,
} from "./useChartEditorStep"
import { useChartRenderError } from "./useChartRenderError"
import { useChartSpecGeneration } from "./useChartSpecGeneration"
import VegaJsonEditor from "./VegaJsonEditor"

// Wide for the two columns; height sizes to content, growing with the preview or the (tall) Monaco
// editor and capped at the viewport. The doubled selector beats the WP Modal's own sizing.
const editorModalStyles = css`
  && {
    width: min(95vw, 1800px);
    max-width: none;
    height: auto;
    max-height: min(92vh, 1200px);
  }
  /* Make WP's content and its (unstyled) children wrapper flex columns so our row fills the height. */
  .components-modal__content {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .components-modal__children-container {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
`

// The steps before the editor hold only a short prompt and one control each, so the dialog sizes
// to its content (height auto) at a modest width.
const stepModalStyles = css`
  && {
    width: min(90vw, 720px);
    max-width: none;
  }
`

const editorLayoutStyles = css`
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: stretch;
  min-height: 0;
  overflow: auto;
`

const editorColumnStyles = css`
  flex: 1 1 360px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  min-height: 0;
`

// The sections stacked under the JSON editor in the left column.
const editorSectionStyles = css`
  flex-shrink: 0;
  margin-top: 1rem;
`

interface ChartEditModalProps {
  isOpen: boolean
  onClose: () => void
  attributes: ChartAttributes
  setAttributes: (attrs: Partial<ChartAttributes>) => void
}

const ChartEditModal: React.FC<ChartEditModalProps> = ({
  isOpen,
  onClose,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const page = useContext(PageContext)?.page
  const pageId = page?.id
  // Extracted data files upload to the same place the media picker's do: the course, or on an exam
  // page the exam.
  const uploadTarget = page?.course_id
    ? { courseId: page.course_id }
    : page?.exam_id
      ? { examId: page.exam_id }
      : null
  const { spec, caption, height, heightIsAuto, dataFileUrl } = attributes
  const [showVegaJson, setShowVegaJson] = useState(false)

  // Data-first flow: a new block starts on the data-file step, then picks a creation method, then
  // lands in the editor.
  const {
    step,
    stepNumber,
    stepCount,
    isRegenerating,
    goToDataStep,
    goToMethodStep,
    goToEditorStep,
    advanceFromDataStep,
    openAiPrompt,
    closeAiPrompt,
  } = useChartEditorStep(spec)

  // The spec as edited, which attribute updates only catch up with on the next render. The async
  // work here — uploads, generation — needs to know what it says right now.
  const latestSpecRef = useRef(spec)
  const getCurrentSpec = () => latestSpecRef.current

  // Spec is the single source of truth: data is always a URL, never inline.
  const updateSpec = (next: string) => {
    latestSpecRef.current = next
    setAttributes({ spec: next })
  }

  const renderError = useChartRenderError(spec)

  const dataFile = useChartDataFile({
    spec,
    dataFileUrl,
    uploadTarget,
    getCurrentSpec,
    writeSpec: updateSpec,
    setDataFileUrl: (url) => setAttributes({ dataFileUrl: url }),
    onFileAttached: advanceFromDataStep,
  })

  const handleSpecChange = (value: string | undefined) => {
    const next = value ?? ""
    updateSpec(next)
    // Caption and the spec's `description` mirror each other; last edit wins.
    try {
      const description = JSON.parse(next)?.description
      if (typeof description === "string" && description.trim() && description !== caption) {
        setAttributes({ caption: description })
      }
    } catch {
      // Mid-edit invalid JSON; the caption syncs on the next valid state.
    }
    dataFile.scheduleExtraction(next)
  }

  const {
    generateSpec,
    repairSpec,
    isGenerating,
    error: aiError,
    reset: resetSpecGeneration,
  } = useChartSpecGeneration({
    dataFileUrl,
    pageId,
    // Generated specs take the same path as hand-written ones, so the caption sync and the
    // inline-data extraction behave identically for both.
    onSpecGenerated: handleSpecChange,
  })

  const { control: captionControl } = useChartCaptionField({
    caption,
    getCurrentSpec,
    onCaptionChange: ({ caption: nextCaption, spec: nextSpec }) => {
      if (nextSpec !== undefined) {
        latestSpecRef.current = nextSpec
      }
      setAttributes({ caption: nextCaption, ...(nextSpec === undefined ? {} : { spec: nextSpec }) })
    },
  })

  const { control: aiPromptControl, watch } = useForm<{ aiPrompt: string }>({
    defaultValues: { aiPrompt: "" },
  })
  const aiPrompt = watch("aiPrompt")

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) {
      return
    }
    // A fresh (empty) block has no spec to edit, so the model writes one from scratch.
    const currentSpec = getCurrentSpec()
    const generated = await generateSpec(prompt, currentSpec.trim() ? currentSpec : null)
    if (!generated) {
      // A failed request keeps the prompt open with the error shown.
      return
    }
    // A spec came back, so move to the editor: the preview, the render error and "Fix with AI"
    // live there, which is what a spec that doesn't render needs.
    if (!isRegenerating) {
      // A chart generated as part of the flow is meant to be judged from the preview, so the JSON
      // starts collapsed. Re-generating from the editor leaves the teacher's own toggle alone.
      setShowVegaJson(false)
    }
    goToEditorStep()
  }

  const startAiPrompt = () => {
    resetSpecGeneration()
    openAiPrompt()
  }

  const handleAiFix = () => {
    const brokenSpec = getCurrentSpec()
    if (!renderError || !brokenSpec.trim()) {
      return
    }
    repairSpec(renderError, brokenSpec)
  }

  const isValidJson = specIsValidJson(spec)

  if (!isOpen) {
    return null
  }

  return (
    <Modal
      title={
        step === STEP_AI
          ? isRegenerating
            ? t("ai-regenerate-chart")
            : t("ai-generate-chart")
          : t("edit-chart")
      }
      // In the AI prompt view, closing (escape / ×) steps back where it was opened from rather than
      // closing the whole block editor.
      onRequestClose={step === STEP_AI ? closeAiPrompt : onClose}
      className={step === STEP_EDITOR ? editorModalStyles : stepModalStyles}
    >
      {step === STEP_DATA && (
        <ChartDataStep
          stepNumber={stepNumber}
          stepCount={stepCount}
          dataFile={dataFile}
          dataFileUrl={dataFileUrl}
          onContinue={goToMethodStep}
        />
      )}
      {step === STEP_METHOD && (
        <ChartMethodStep
          stepNumber={stepNumber}
          stepCount={stepCount}
          onGenerateWithAi={startAiPrompt}
          onWriteManually={() => {
            setShowVegaJson(true)
            goToEditorStep()
          }}
          onBack={goToDataStep}
        />
      )}
      {step === STEP_AI && (
        <ChartAiPromptStep
          stepNumber={stepNumber}
          stepCount={stepCount}
          control={aiPromptControl}
          prompt={aiPrompt}
          isGenerating={isGenerating}
          hasDataFile={Boolean(dataFileUrl)}
          error={aiError}
          isRegenerating={isRegenerating}
          onCancel={closeAiPrompt}
          onGenerate={() => void handleAiGenerate()}
        />
      )}
      {/* The finished chart: spec, data file, caption and preview side by side. Also where an
          already-built chart opens. */}
      {step === STEP_EDITOR && (
        <div className={editorLayoutStyles}>
          <div className={editorColumnStyles}>
            <VegaJsonEditor
              spec={spec}
              isValidJson={isValidJson}
              isShown={showVegaJson}
              onToggle={() => setShowVegaJson((shown) => !shown)}
              onChange={handleSpecChange}
              onRegenerate={startAiPrompt}
            />
            <div className={editorSectionStyles}>
              <ChartDataFileSection dataFile={dataFile} dataFileUrl={dataFileUrl} />
            </div>
            <div className={editorSectionStyles}>
              <TextField
                name="caption"
                control={captionControl}
                label={t("caption")}
                isRequired
                placeholder={t("describe-the-chart")}
                {...(caption.trim() ? {} : { errorMessage: t("required") })}
              />
            </div>
          </div>
          <div className={editorColumnStyles}>
            <ChartPreviewPane
              spec={spec}
              height={height}
              heightIsAuto={heightIsAuto}
              caption={caption}
              renderError={renderError}
              isValidJson={isValidJson}
              isGenerating={isGenerating}
              aiError={aiError}
              onFixWithAi={handleAiFix}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ChartEditModal
