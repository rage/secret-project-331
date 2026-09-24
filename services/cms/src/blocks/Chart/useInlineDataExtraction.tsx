"use client"

import { useEffect, useRef, useState } from "react"

import type { MediaUploadType } from "@/services/mediaUpload"
import { uploadFileFromPage } from "@/services/mediaUpload"

import { extractInlineData } from "./chartSpec"

const EXTRACTED_DATA_BASENAME = "chart-data"

// Wait for a paste or edit to settle before extracting, so the data uploads once rather than per
// keystroke, and so rewriting the spec doesn't move the teacher's caret mid-edit.
const EDITING_PAUSE_MS = 800

interface InlineDataExtractionOptions {
  /** Where extracted files upload to; null on a page belonging to neither a course nor an exam. */
  uploadTarget: MediaUploadType | null
  /** The spec as it currently stands, so an upload can tell whether editing has moved on. */
  getCurrentSpec: () => string
  /** Applies the spec rewritten to point at the uploaded file. */
  onDataExtracted: (spec: string, dataFileUrl: string) => void
  /** Reports an upload failure, or undefined when a new extraction clears a previous one. */
  onError: (message: string | undefined) => void
}

interface InlineDataExtraction {
  isExtracting: boolean
  /** The file the data was moved into, so the teacher can be told it was separated out. */
  extractedDataUrl: string | undefined
  clearExtractedDataUrl: () => void
  /** Extracts once editing pauses; calling again restarts the wait. */
  scheduleExtraction: (spec: string) => void
  cancelScheduledExtraction: () => void
}

/**
 * Moves a pasted spec's inline data into a saved file and points the spec at it by URL, so that the
 * spec stays a description of the chart and the data lives in one place.
 */
export const useInlineDataExtraction = ({
  uploadTarget,
  getCurrentSpec,
  onDataExtracted,
  onError,
}: InlineDataExtractionOptions): InlineDataExtraction => {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedDataUrl, setExtractedDataUrl] = useState<string | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const uploadInFlightRef = useRef(false)

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    },
    [],
  )

  const scheduleExtraction = (spec: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => void extractAndUpload(spec), EDITING_PAUSE_MS)
  }

  const extractAndUpload = async (spec: string) => {
    const extracted = extractInlineData(spec)
    if (!extracted || !uploadTarget) {
      return
    }
    if (uploadInFlightRef.current) {
      // Try again once that upload finishes, instead of leaving this edit's data inline.
      scheduleExtraction(spec)
      return
    }
    uploadInFlightRef.current = true
    setIsExtracting(true)
    onError(undefined)
    try {
      const file = new File(
        [extracted.contents],
        `${EXTRACTED_DATA_BASENAME}.${extracted.extension}`,
        { type: extracted.mime },
      )
      const uploaded = await uploadFileFromPage(file, uploadTarget)
      // Don't clobber edits made while the upload was in flight.
      if (getCurrentSpec() !== spec) {
        return
      }
      const rewritten = {
        ...extracted.specWithoutData,
        data: { url: uploaded.url, format: { type: extracted.extension } },
      }
      onDataExtracted(JSON.stringify(rewritten, null, 2), uploaded.url)
      setExtractedDataUrl(uploaded.url)
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      uploadInFlightRef.current = false
      setIsExtracting(false)
    }
  }

  return {
    isExtracting,
    extractedDataUrl,
    clearExtractedDataUrl: () => setExtractedDataUrl(undefined),
    scheduleExtraction,
    cancelScheduledExtraction: () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    },
  }
}
