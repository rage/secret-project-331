"use client"

import { css } from "@emotion/css"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { Modal, Placeholder } from "@wordpress/components"
import { image as icon } from "@wordpress/icons"
import React, { useContext, useEffect, useRef, useState } from "react"

import ChartPreview from "./ChartPreview"
import { dataUrlFromSpec, extractInlineData, specWithDataUrl } from "./chartSpec"

import { ChartBlockAttributes, DEFAULT_VEGA_LITE_SPEC } from "."

import CourseContext from "@/contexts/CourseContext"
import { uploadFileFromPage } from "@/services/mediaUpload"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import MonacoEditor from "@/shared-module/common/components/monaco/MonacoEditor"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import { useTranslation } from "@/utils/useCmsTranslation"

// Config/identifier strings kept out of i18next/no-literal-string.
const MONACO_LANGUAGE = "json"
const ON = "on"
const EXTRACTED_DATA_BASENAME = "chart-data"

const ALLOWED_DATA_FILE_MIMETYPES = ["text/csv", "application/json"]

// Wait for a paste/edit to settle before extracting, so we upload once rather than per keystroke.
const DATA_EXTRACTION_DEBOUNCE_MS = 800

// Scale the dialog with the viewport; the doubled selector beats the WP Modal's own sizing.
const modalStyles = css`
  && {
    width: min(95vw, 1800px);
    max-width: none;
    height: min(92vh, 1200px);
    max-height: none;
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
  const { spec, caption, height } = attributes
  const [dataFileError, setDataFileError] = useState<string | undefined>(undefined)
  const [extractedDataUrl, setExtractedDataUrl] = useState<string | undefined>(undefined)
  const [isExtractingData, setIsExtractingData] = useState(false)

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
    updateSpec(next)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      void extractAndUploadInlineData(next)
    }, DATA_EXTRACTION_DEBOUNCE_MS)
  }

  const handleDataFileSelect = (media: MediaObject) => {
    setExtractedDataUrl(undefined)
    const rewritten = specWithDataUrl(latestSpecRef.current, media.url)
    if (!rewritten) {
      setDataFileError(t("invalid-json"))
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
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(latestSpecRef.current)
    } catch {
      return
    }
    const { data: _omitted, ...specWithoutData } = parsed
    updateSpec(JSON.stringify(specWithoutData, null, 2))
  }

  const isValidJson = (() => {
    try {
      JSON.parse(spec)
      return true
    } catch {
      return false
    }
  })()

  const dataUrl = dataUrlFromSpec(spec)

  if (!isOpen) {
    return null
  }

  return (
    <Modal title={t("edit-chart")} onRequestClose={onClose} className={modalStyles}>
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
                onClick={() => updateSpec(DEFAULT_VEGA_LITE_SPEC)}
              >
                {t("reset-to-example")}
              </Button>
            </div>
          </div>
          <div
            className={css`
              /* Fills the leftover column height; the sections below keep their size. */
              flex: 1 1 0;
              min-height: 0;
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
              onChange={handleSpecChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: ON,
                scrollBeyondLastLine: false,
                wordWrap: ON,
                tabSize: 2,
                // Re-measure so height: 100% tracks the flex parent.
                automaticLayout: true,
              }}
            />
          </div>
          <div
            className={css`
              flex-shrink: 0;
              margin-top: 1rem;
            `}
          >
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
            {dataUrl ? (
              <Placeholder
                icon={<BlockIcon icon={icon} />}
                label={t("chart-data-file")}
                instructions={decodeURIComponent(dataUrl.split("/").pop() ?? dataUrl)}
              >
                <Button variant="tertiary" size="medium" onClick={handleDataFileRemove}>
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
          </div>
          <div
            className={css`
              flex-shrink: 0;
              margin-top: 1rem;
            `}
          >
            <TextField
              label={t("caption-optional")}
              value={caption}
              onChangeByValue={(value) => setAttributes({ caption: value })}
              placeholder={t("describe-the-chart")}
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
            <ChartPreview spec={spec} height={height} caption={caption} />
          </div>
        </div>
      </div>
      <div
        className={css`
          display: flex;
          justify-content: flex-end;
          margin-top: 1.5rem;
          flex-shrink: 0;
        `}
      >
        <Button variant="primary" size="medium" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </Modal>
  )
}

export default ChartBlockEditModal
