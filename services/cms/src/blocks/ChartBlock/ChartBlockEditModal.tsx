"use client"

import { css } from "@emotion/css"
import type { Monaco } from "@monaco-editor/react"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { Modal, Placeholder } from "@wordpress/components"
import { image as icon } from "@wordpress/icons"
import React, { useContext, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"

import CourseContext from "@/contexts/CourseContext"
import PageContext from "@/contexts/PageContext"
import { requestChartSpecGeneration } from "@/generated/api/sdk.generated"
import { uploadFileFromPage } from "@/services/mediaUpload"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import MonacoEditor from "@/shared-module/common/components/monaco/MonacoEditor"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components/components/Button"
import { TextArea } from "@/shared-module/components/components/TextArea"
import { TextField } from "@/shared-module/components/components/TextField"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChartBlockAttributes } from "."
import ChartPreview from "./ChartPreview"
import {
  dataFormatForUrl,
  dataUrlFromSpec,
  extractInlineData,
  specDefinesView,
  specWithDataUrl,
} from "./chartSpec"
import { validateChartSpec } from "./validateChartSpec"

// Config/identifier strings kept out of i18next/no-literal-string.
const MONACO_LANGUAGE = "json"
const ON = "on"
const EXTRACTED_DATA_BASENAME = "chart-data"

const ALLOWED_DATA_FILE_MIMETYPES = ["text/csv", "application/json"]

// Wait for a paste/edit to settle before extracting, so we upload once rather than per keystroke.
const DATA_EXTRACTION_DEBOUNCE_MS = 800

// Debounce render validation so a large spec isn't recompiled on every keystroke.
const RENDER_VALIDATION_DEBOUNCE_MS = 300

// Why a spec string won't render, or null if it renders (or isn't a complete view yet): either
// malformed JSON, or JSON that parses but fails the same compile the renderer does. See
// validateChartSpec.
const renderErrorFor = (specString: string): string | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(specString)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  if (!specDefinesView(parsed)) {
    return null
  }
  const result = validateChartSpec(parsed as object)
  return result.ok ? null : (result.error ?? null)
}

// Let Monaco fetch the schema named in the spec's $schema field (the Vega-Lite schema),
// enabling validation and autocompletion in the JSON editor.
const enableJsonSchemaSupport = (monaco: Monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: true,
  })
}

const VEGA_JSON_EDITOR_ID = "chart-block-vega-json-editor"
const VEGA_JSON_RESIZE_HINT_ID = "chart-block-vega-json-resize-hint"
const VEGA_JSON_DEFAULT_HEIGHT = 360
const VEGA_JSON_MIN_HEIGHT = 160
const VEGA_JSON_MAX_HEIGHT = 900
// Height change per arrow-key press while the resize handle has focus.
const VEGA_JSON_RESIZE_STEP = 40

const clampVegaJsonHeight = (height: number) =>
  Math.min(VEGA_JSON_MAX_HEIGHT, Math.max(VEGA_JSON_MIN_HEIGHT, height))
// Enough of the data file for the model to see field names and value shapes.
const DATA_SAMPLE_MAX_CHARS = 4000

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

// The data-file step holds only a short prompt and the upload box, so the dialog sizes to its
// content (height auto) at a modest width.
const dataFileModalStyles = css`
  && {
    width: min(90vw, 720px);
    max-width: none;
  }
`

interface MediaObject {
  url: string
  [key: string]: unknown
}

interface ChartBlockEditModalProps {
  isOpen: boolean
  onClose: () => void
  attributes: ChartBlockAttributes
  setAttributes: (attrs: Partial<ChartBlockAttributes>) => void
}

const ChartBlockEditModal: React.FC<ChartBlockEditModalProps> = ({
  isOpen,
  onClose,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const courseId = useContext(CourseContext)?.courseId
  const pageId = useContext(PageContext)?.page.id
  const { spec, caption, height } = attributes
  const [dataFileError, setDataFileError] = useState<string | undefined>(undefined)
  const [extractedDataUrl, setExtractedDataUrl] = useState<string | undefined>(undefined)
  const [isExtractingData, setIsExtractingData] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [showVegaJson, setShowVegaJson] = useState(false)
  const [vegaJsonHeight, setVegaJsonHeight] = useState(VEGA_JSON_DEFAULT_HEIGHT)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiError, setAiError] = useState<unknown>(undefined)

  // Data-first flow: a new block (empty spec) opens on the data-file step; everything else opens
  // straight in the editor. Latched one-way: once the block has a spec, it stays in the editor.
  const [inEditor, setInEditor] = useState(() => Boolean(spec?.trim()))
  useEffect(() => {
    if (spec?.trim()) {
      setInEditor(true)
    }
  }, [spec])

  // The uploaded data file, remembered independently of the spec text. Latched from the spec
  // whenever it carries a data URL; only the Remove button clears it.
  const [attachedDataUrl, setAttachedDataUrl] = useState<string | undefined>(() =>
    dataUrlFromSpec(spec),
  )
  useEffect(() => {
    const url = dataUrlFromSpec(spec)
    if (url) {
      setAttachedDataUrl(url)
    }
  }, [spec])

  // Drives the error box and its "Fix with AI" affordance. Debounced so a large spec isn't
  // recompiled per keystroke, and so a half-typed spec isn't flagged instantly.
  const [renderError, setRenderError] = useState<string | null>(null)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setRenderError(spec?.trim() ? renderErrorFor(spec) : null)
    }, RENDER_VALIDATION_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [spec])

  // The new shared TextField/TextArea are react-hook-form based. The caption also changes
  // outside the form (spec edits sync `description` into it), so the form is kept in sync
  // with the attribute in both directions below.
  const { control, watch, getValues, setValue } = useForm<{ aiPrompt: string; caption: string }>({
    defaultValues: { aiPrompt: "", caption },
  })
  const aiPrompt = watch("aiPrompt")

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Latest spec, so an in-flight upload can bail if the teacher kept editing.
  const latestSpecRef = useRef(spec)
  const extractingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Spec is the single source of truth: data is always a URL, never inline.
  const updateSpec = (next: string) => {
    latestSpecRef.current = next
    setAttributes({ spec: next })
  }

  // Move a pasted spec's inline data into a saved file and point the spec at it by URL.
  const extractAndUploadInlineData = async (specString: string) => {
    if (!courseId || extractingRef.current) {
      return
    }
    const extracted = extractInlineData(specString)
    if (!extracted) {
      return
    }
    extractingRef.current = true
    setIsExtractingData(true)
    setDataFileError(undefined)
    try {
      const file = new File(
        [extracted.contents],
        `${EXTRACTED_DATA_BASENAME}.${extracted.extension}`,
        {
          type: extracted.mime,
        },
      )
      const uploaded = await uploadFileFromPage(file, { courseId })
      // Don't clobber edits made while the upload was in flight.
      if (latestSpecRef.current !== specString) {
        return
      }
      const rewritten = {
        ...extracted.specWithoutData,
        data: { url: uploaded.url, format: { type: extracted.extension } },
      }
      updateSpec(JSON.stringify(rewritten, null, 2))
      setExtractedDataUrl(uploaded.url)
    } catch (error) {
      setDataFileError(error instanceof Error ? error.message : String(error))
    } finally {
      extractingRef.current = false
      setIsExtractingData(false)
    }
  }

  const handleSpecChange = (value: string | undefined) => {
    const next = value ?? ""
    // If a valid edit dropped the data reference while a file is still attached, re-bind it so the
    // chart keeps its data.
    let toSave = next
    try {
      const parsed = JSON.parse(next)
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        !parsed.data &&
        attachedDataUrl
      ) {
        const rebound = specWithDataUrl(next, attachedDataUrl)
        if (rebound) {
          toSave = JSON.stringify(rebound, null, 2)
        }
      }
    } catch {
      // Invalid JSON mid-edit; save as-is and re-bind once it's valid again.
    }
    updateSpec(toSave)
    // Caption and the spec's `description` mirror each other; last edit wins.
    try {
      const description = JSON.parse(toSave)?.description
      if (typeof description === "string" && description.trim() && description !== caption) {
        setAttributes({ caption: description })
      }
    } catch {
      // Mid-edit invalid JSON; the caption syncs on the next valid state.
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      void extractAndUploadInlineData(toSave)
    }, DATA_EXTRACTION_DEBOUNCE_MS)
  }

  // Instruction that asks the model to repair a spec, embedding the renderer's error. Not
  // HTML-escaped so the raw error text reaches the model intact.
  const fixPromptFor = (error: string) =>
    t("ai-fix-chart-prompt", { error, interpolation: { escapeValue: false } })

  // One round-trip to the generator, returning the produced spec with the data file re-bound.
  const requestSpec = async (prompt: string, currentSpec: string | null): Promise<string> => {
    let dataSample: string | undefined
    if (attachedDataUrl) {
      try {
        const res = await fetch(attachedDataUrl)
        if (res.ok) {
          dataSample = (await res.text()).slice(0, DATA_SAMPLE_MAX_CHARS)
        }
      } catch {
        // The sample is optional context; generate without it.
      }
    }
    const response = await requestChartSpecGeneration({
      body: {
        prompt,
        current_spec: currentSpec,
        data_url: attachedDataUrl ?? null,
        data_format: attachedDataUrl ? (dataFormatForUrl(attachedDataUrl)?.type ?? null) : null,
        data_sample: dataSample ?? null,
        page_id: pageId ?? null,
      },
    })
    // Keep the teacher's data file bound even if the model changed or dropped the URL.
    const rebound = attachedDataUrl ? specWithDataUrl(response.spec, attachedDataUrl) : null
    return rebound ? JSON.stringify(rebound, null, 2) : response.spec
  }

  // Generate a spec and apply it. If the result won't render, retry once with the error as context;
  // whatever comes back is applied, and if it's still broken the manual "Fix with AI" button takes
  // over.
  const generateSpec = async (options: {
    prompt: string
    currentSpec: string | null
  }): Promise<boolean> => {
    if (isGenerating) {
      return false
    }
    setIsGenerating(true)
    setAiError(undefined)
    try {
      let result = await requestSpec(options.prompt, options.currentSpec)
      const error = renderErrorFor(result)
      if (error) {
        result = await requestSpec(fixPromptFor(error), result)
      }
      // Result flows through handleSpecChange so caption sync + inline-data extraction match a
      // hand-written spec.
      handleSpecChange(result)
      return true
    } catch (error) {
      setAiError(error)
      return false
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAiGenerate = async () => {
    const prompt = getValues("aiPrompt").trim()
    if (!prompt) {
      return
    }
    // A fresh (empty) block has no spec to edit, so the model writes one from scratch.
    const currentSpec = latestSpecRef.current
    const requestSucceeded = await generateSpec({
      prompt,
      currentSpec: currentSpec.trim() ? currentSpec : null,
    })
    // A spec came back, so return to the editor: the preview, the render error and "Fix with AI"
    // live there, which is what a spec that doesn't render needs. A failed request keeps the prompt
    // open with its error instead.
    if (requestSucceeded) {
      setAiMode(false)
    }
  }

  // Manual repair: hand the failing spec and its error back to the model.
  const handleAiFix = () => {
    const brokenSpec = latestSpecRef.current
    if (!renderError || !brokenSpec.trim()) {
      return
    }
    void generateSpec({ prompt: fixPromptFor(renderError), currentSpec: brokenSpec })
  }

  const handleCaptionChange = (value: string) => {
    const attrs: Partial<ChartBlockAttributes> = { caption: value }
    try {
      const parsed = JSON.parse(latestSpecRef.current)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (value.trim()) {
          parsed.description = value
        } else {
          delete parsed.description
        }
        const nextSpec = JSON.stringify(parsed, null, 2)
        latestSpecRef.current = nextSpec
        attrs.spec = nextSpec
      }
    } catch {
      // Spec isn't valid JSON right now; only the caption updates.
    }
    setAttributes(attrs)
  }

  // Attribute -> form: spec edits sync the spec's `description` into the caption attribute.
  useEffect(() => {
    if (caption !== getValues("caption")) {
      setValue("caption", caption)
    }
  }, [caption, getValues, setValue])

  // Form -> attribute: the teacher typing in the caption field. Re-subscribed every render
  // so the callback never closes over a stale handleCaptionChange.
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name === "caption") {
        handleCaptionChange(values.caption ?? "")
      }
    })
    return () => subscription.unsubscribe()
  })

  const handleDataFileSelect = (media: MediaObject) => {
    setExtractedDataUrl(undefined)
    const rewritten = specWithDataUrl(latestSpecRef.current, media.url)
    if (!rewritten) {
      setDataFileError(t("chart-data-file-ok-but-spec-invalid"))
      return
    }
    setDataFileError(undefined)
    updateSpec(JSON.stringify(rewritten, null, 2))
  }

  const handleDataFileError = (error: unknown) => {
    setDataFileError(error instanceof Error ? error.message : String(error))
  }

  const handleDataFileRemove = () => {
    setExtractedDataUrl(undefined)
    setAttachedDataUrl(undefined)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(latestSpecRef.current)
    } catch {
      return
    }
    const { data: _omitted, ...specWithoutData } = parsed
    updateSpec(JSON.stringify(specWithoutData, null, 2))
  }

  // Pointer drag on the JSON editor's resize handle. Pointer capture keeps events flowing to the
  // handle even as the cursor moves outside it.
  const vegaResizeDrag = useRef<{ startY: number; startHeight: number } | null>(null)
  const handleVegaResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Focus explicitly: the arrow keys only reach this handle once it holds focus, and a plain
    // pointer press on a div doesn't focus it in every browser. Text selection is suppressed with
    // user-select rather than preventDefault, which would cancel focus altogether.
    e.currentTarget.focus()
    e.currentTarget.setPointerCapture(e.pointerId)
    vegaResizeDrag.current = { startY: e.clientY, startHeight: vegaJsonHeight }
  }
  const handleVegaResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = vegaResizeDrag.current
    if (!drag) {
      return
    }
    setVegaJsonHeight(clampVegaJsonHeight(drag.startHeight + (e.clientY - drag.startY)))
  }
  const handleVegaResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    vegaResizeDrag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const handleVegaResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowDown"
        ? VEGA_JSON_RESIZE_STEP
        : e.key === "ArrowUp"
          ? -1 * VEGA_JSON_RESIZE_STEP
          : 0
    if (step === 0) {
      return
    }
    // Keep the arrows on the handle instead of scrolling the page behind the dialog.
    e.preventDefault()
    setVegaJsonHeight((height) => clampVegaJsonHeight(height + step))
  }

  const isValidJson = (() => {
    try {
      JSON.parse(spec)
      return true
    } catch {
      return false
    }
  })()

  if (!isOpen) {
    return null
  }

  const dataFileSection = (
    <>
      {dataFileError && <ErrorBanner error={dataFileError} />}
      {/* The live region must exist before content changes for screen readers to announce it. */}
      <div aria-live="polite">
        {isExtractingData && (
          <p
            className={css`
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[600]};
              margin: 0 0 0.5rem;
            `}
          >
            {t("separating-chart-data")}
          </p>
        )}
        {extractedDataUrl && (
          <div
            className={css`
              padding: 0.75rem 1rem;
              margin-bottom: 0.5rem;
              background: ${baseTheme.colors.yellow[100]};
              border: 1px solid ${baseTheme.colors.yellow[300]};
              border-radius: 4px;
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("chart-data-extracted-warning")}{" "}
            <a href={extractedDataUrl} target="_blank" rel="noopener noreferrer">
              {t("view-data-file")}
            </a>
          </div>
        )}
      </div>
      {attachedDataUrl ? (
        <Placeholder
          icon={<BlockIcon icon={icon} />}
          label={t("chart-data-file")}
          instructions={decodeURIComponent(attachedDataUrl.split("/").pop() ?? attachedDataUrl)}
        >
          <Button variant="tertiary" size="medium" onPress={handleDataFileRemove}>
            {t("remove")}
          </Button>
        </Placeholder>
      ) : isExtractingData ? null : (
        <MediaPlaceholder
          icon={<BlockIcon icon={icon} />}
          labels={{
            title: t("chart-data-file"),
            instructions: t("chart-data-file-instructions"),
          }}
          onSelect={handleDataFileSelect}
          accept={ALLOWED_DATA_FILE_MIMETYPES.join(",")}
          allowedTypes={ALLOWED_DATA_FILE_MIMETYPES}
          onError={handleDataFileError}
          onHTMLDrop={undefined}
        />
      )}
    </>
  )

  return (
    <Modal
      title={aiMode ? t("ai-generate-chart") : t("edit-chart")}
      // In the AI prompt view, closing (escape / ×) steps back to the editor rather than closing
      // the whole block editor.
      onRequestClose={aiMode ? () => setAiMode(false) : onClose}
      className={inEditor && !aiMode ? editorModalStyles : dataFileModalStyles}
    >
      {/* Data-first: a brand-new block (empty spec) asks for a data file before revealing the spec
          editor and preview. */}
      {!inEditor && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 1rem;
            width: 100%;
            max-width: 640px;
            margin: 0 auto;
          `}
        >
          <p
            className={css`
              margin: 0;
              font-family: ${primaryFont};
              font-size: 0.9375rem;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("chart-block-start-with-data-file")}
          </p>
          {dataFileSection}
        </div>
      )}
      {inEditor && aiMode && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 1rem;
            width: 100%;
            max-width: 640px;
            margin: 0 auto;
          `}
        >
          <TextArea
            name="aiPrompt"
            control={control}
            label={t("ai-chart-prompt-label")}
            placeholder={t("ai-chart-prompt-placeholder")}
            rows={4}
            isDisabled={isGenerating}
          />
          {!isGenerating && !attachedDataUrl && (
            <span
              className={css`
                font-family: ${primaryFont};
                font-size: 0.8125rem;
                font-weight: ${fontWeights.medium};
                color: ${baseTheme.colors.red[600]};
              `}
            >
              {t("ai-generate-needs-data-file")}
            </span>
          )}
          {/* The live region must exist before content changes for screen readers to announce it. */}
          <div aria-live="polite">
            {isGenerating && (
              <span
                className={css`
                  font-family: ${primaryFont};
                  font-size: 0.8125rem;
                  color: ${baseTheme.colors.gray[600]};
                `}
              >
                {t("ai-generating-chart")}
              </span>
            )}
          </div>
          {aiError !== undefined && <ErrorBanner error={aiError} />}
          <div
            className={css`
              display: flex;
              justify-content: flex-end;
              gap: 0.75rem;
            `}
          >
            <Button
              variant="secondary"
              size="medium"
              onPress={() => setAiMode(false)}
              disabled={isGenerating}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              size="medium"
              onPress={() => void handleAiGenerate()}
              isLoading={isGenerating}
              disabled={!aiPrompt.trim() || !attachedDataUrl}
            >
              {t("generate")}
            </Button>
          </div>
        </div>
      )}
      {inEditor && !aiMode && (
        <div
          className={css`
            display: flex;
            flex: 1;
            flex-wrap: wrap;
            gap: 1.5rem;
            align-items: stretch;
            min-height: 0;
            overflow: auto;
          `}
        >
          <div
            className={css`
              flex: 1 1 360px;
              min-width: 320px;
              display: flex;
              flex-direction: column;
              min-height: 0;
            `}
          >
            <div
              className={css`
                display: flex;
                flex-shrink: 0;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 0.5rem;
              `}
            >
              <p
                className={css`
                  margin: 0;
                  font-family: ${primaryFont};
                  font-size: 0.8125rem;
                  color: ${baseTheme.colors.gray[700]};
                  font-weight: ${fontWeights.medium};
                `}
              >
                {t("vega-lite-json-specification")}
              </p>
              <div
                className={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                `}
              >
                {!isValidJson && (
                  <span
                    className={css`
                      font-size: 0.75rem;
                      color: ${baseTheme.colors.red[600]};
                    `}
                  >
                    {t("invalid-json")}
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="small"
                  onPress={() => setShowVegaJson((shown) => !shown)}
                  domProps={{ "aria-expanded": showVegaJson, "aria-controls": VEGA_JSON_EDITOR_ID }}
                >
                  {showVegaJson ? t("hide-vega-json") : t("view-vega-json")}
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onPress={() => {
                    setAiError(undefined)
                    setAiMode(true)
                  }}
                >
                  {t("ai-generate-chart")}
                </Button>
              </div>
            </div>
            {showVegaJson && (
              <>
                <div
                  id={VEGA_JSON_EDITOR_ID}
                  className={css`
                    /* Height is teacher-controlled via the drag handle below; the modal grows to
                       include it. */
                    flex: 0 0 auto;
                    height: ${vegaJsonHeight}px;
                    border: 1px solid
                      ${isValidJson ? baseTheme.colors.gray[400] : baseTheme.colors.red[400]};
                    border-radius: 4px;
                    overflow: hidden;
                    /* MonacoEditorImpl adds a height-less wrapper div; force it to fill so the editor can
                     size to this box. */
                    & > div {
                      height: 100%;
                    }
                  `}
                >
                  <MonacoEditor
                    height="100%"
                    language={MONACO_LANGUAGE}
                    value={spec}
                    beforeMount={enableJsonSchemaSupport}
                    onChange={handleSpecChange}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: ON,
                      scrollBeyondLastLine: false,
                      wordWrap: ON,
                      tabSize: 2,
                      // Re-measure so height: 100% tracks the container as it's resized.
                      automaticLayout: true,
                      // Tab moves focus out of the editor instead of inserting an indent, so the
                      // dialog stays keyboard-navigable. Ctrl+M toggles it back to indenting.
                      tabFocusMode: true,
                    }}
                  />
                </div>
                <div
                  className={css`
                    flex-shrink: 0;
                    /* The hint only helps someone operating the handle by keyboard, so it shows while
                     the handle has focus. Its space stays reserved so focusing doesn't shift the
                     sections below. */
                    &:focus-within > p {
                      opacity: 1;
                    }
                  `}
                >
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-controls={VEGA_JSON_EDITOR_ID}
                    aria-label={t("resize-vega-json-editor")}
                    aria-describedby={VEGA_JSON_RESIZE_HINT_ID}
                    aria-valuenow={vegaJsonHeight}
                    aria-valuemin={VEGA_JSON_MIN_HEIGHT}
                    aria-valuemax={VEGA_JSON_MAX_HEIGHT}
                    tabIndex={0}
                    onPointerDown={handleVegaResizeStart}
                    onPointerMove={handleVegaResizeMove}
                    onPointerUp={handleVegaResizeEnd}
                    onKeyDown={handleVegaResizeKeyDown}
                    className={css`
                      height: 12px;
                      cursor: row-resize;
                      touch-action: none;
                      user-select: none;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      /* :focus, not :focus-visible — a click focuses the handle to enable the arrow
                       keys, and that has to be visible. */
                      &:focus {
                        outline: 2px solid ${baseTheme.colors.green[600]};
                        outline-offset: -2px;
                      }
                      /* Grip: a short bar that darkens on hover/focus. */
                      &::after {
                        content: "";
                        width: 2rem;
                        height: 3px;
                        border-radius: 3px;
                        background: ${baseTheme.colors.gray[400]};
                      }
                      &:hover::after,
                      &:focus::after {
                        background: ${baseTheme.colors.gray[600]};
                      }
                    `}
                  />
                  <p
                    id={VEGA_JSON_RESIZE_HINT_ID}
                    className={css`
                      opacity: 0;
                      transition: opacity 0.15s ease;
                      margin: 0.125rem 0 0;
                      text-align: center;
                      font-family: ${primaryFont};
                      font-size: 0.75rem;
                      color: ${baseTheme.colors.gray[600]};
                    `}
                  >
                    {t("vega-json-resize-hint")}
                  </p>
                </div>
              </>
            )}
            <div
              className={css`
                flex-shrink: 0;
                margin-top: 1rem;
              `}
            >
              {dataFileSection}
            </div>
            <div
              className={css`
                flex-shrink: 0;
                margin-top: 1rem;
              `}
            >
              <TextField
                name="caption"
                control={control}
                label={t("caption")}
                isRequired
                placeholder={t("describe-the-chart")}
                {...(caption.trim() ? {} : { errorMessage: t("required") })}
              />
            </div>
          </div>
          <div
            className={css`
              flex: 1 1 360px;
              min-width: 320px;
              display: flex;
              flex-direction: column;
              min-height: 0;
            `}
          >
            <p
              className={css`
                margin: 0 0 0.5rem;
                font-family: ${primaryFont};
                font-size: 0.8125rem;
                color: ${baseTheme.colors.gray[700]};
                font-weight: ${fontWeights.medium};
              `}
            >
              {t("preview")}
            </p>
            <div
              className={css`
                flex: 1;
                min-height: 0;
                overflow: auto;
              `}
            >
              <ChartPreview
                spec={spec}
                height={height}
                caption={caption}
                showCaption
                warnOnMobileOverflow
              />
            </div>
            {renderError && (
              <div
                className={css`
                  flex-shrink: 0;
                  margin-top: 0.75rem;
                  padding: 0.75rem 1rem;
                  background: ${baseTheme.colors.red[100]};
                  border: 1px solid ${baseTheme.colors.red[400]};
                  border-radius: 4px;
                `}
              >
                <p
                  className={css`
                    margin: 0 0 0.25rem;
                    font-family: ${primaryFont};
                    font-size: 0.8125rem;
                    font-weight: ${fontWeights.medium};
                    color: ${baseTheme.colors.red[700]};
                  `}
                >
                  {isValidJson ? t("chart-render-error") : t("invalid-json")}
                </p>
                <p
                  className={css`
                    margin: 0 0 0.75rem;
                    font-family: ${primaryFont};
                    font-size: 0.75rem;
                    color: ${baseTheme.colors.gray[700]};
                    word-break: break-word;
                  `}
                >
                  {renderError}
                </p>
                <Button
                  variant="primary"
                  size="small"
                  onPress={handleAiFix}
                  isLoading={isGenerating}
                >
                  {t("fix-with-ai")}
                </Button>
                {aiError !== undefined && (
                  <div
                    className={css`
                      margin-top: 0.5rem;
                    `}
                  >
                    <ErrorBanner error={aiError} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ChartBlockEditModal
