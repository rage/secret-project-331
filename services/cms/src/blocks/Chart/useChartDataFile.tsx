"use client"

import React, { useRef, useState } from "react"

import type { MediaUploadType } from "@/services/mediaUpload"
import { useTranslation } from "@/utils/useCmsTranslation"

import { specWithDataUrl } from "./chartSpec"
import { useDataFileDetachedNotice } from "./useDataFileDetachedNotice"
import { useInlineDataExtraction } from "./useInlineDataExtraction"

/** What the media picker hands back when a file is chosen. */
export interface MediaObject {
  url: string
  [key: string]: unknown
}

interface ChartDataFileOptions {
  /** The spec as stored on the block, for noticing when it stops referencing the file. */
  spec: string
  /** The file currently attached to the block, if any. */
  dataFileUrl: string | undefined
  /** Where extracted data uploads to; null on a page belonging to neither a course nor an exam. */
  uploadTarget: MediaUploadType | null
  /** The spec as edited, which the block's attributes only catch up with on the next render. */
  getCurrentSpec: () => string
  writeSpec: (spec: string) => void
  setDataFileUrl: (url: string | undefined) => void
  /** Called once a file has been attached, so the caller can move the teacher onwards. */
  onFileAttached: () => void
}

export interface ChartDataFile {
  /** Why the last data file operation failed, or undefined when none has. */
  error: string | undefined
  /** Inline data is being separated out of the spec into a file right now. */
  isExtracting: boolean
  /** The file inline data was moved into, so the teacher can be told it was separated out. */
  extractedDataUrl: string | undefined
  /** The spec has stopped referencing the attached file, so it can be offered back. */
  isDetached: boolean
  /** The file was just put back, for announcing a change that is otherwise only visual. */
  restoreConfirmed: boolean
  /** Attach to the remove button, which takes focus when the restore button unmounts. */
  removeButtonRef: React.RefObject<HTMLButtonElement | null>
  selectFile: (media: MediaObject) => void
  reportUploadError: (error: unknown) => void
  removeFile: () => void
  reinsertFile: () => void
  /** Lifts inline data out of an edited spec once editing pauses. */
  scheduleExtraction: (spec: string) => void
}

/**
 * The chart's data file: attaching one, removing it, putting it back after an edit dropped it, and
 * lifting inline data out of a pasted spec into a file of its own.
 *
 * The spec stays owned by the caller — this only hands it back rewritten — but the two are kept in
 * step here, since every operation on the file has to move the spec's `data` with it.
 */
export const useChartDataFile = ({
  spec,
  dataFileUrl,
  uploadTarget,
  getCurrentSpec,
  writeSpec,
  setDataFileUrl,
  onFileAttached,
}: ChartDataFileOptions): ChartDataFile => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | undefined>(undefined)
  // Focus lands here when the restore button that had it unmounts.
  const removeButtonRef = useRef<HTMLButtonElement>(null)

  const { isDetached, restoreConfirmed, confirmRestore } = useDataFileDetachedNotice({
    spec,
    dataFileUrl,
  })

  const {
    isExtracting,
    extractedDataUrl,
    clearExtractedDataUrl,
    scheduleExtraction,
    cancelScheduledExtraction,
  } = useInlineDataExtraction({
    uploadTarget,
    getCurrentSpec,
    onDataExtracted: (nextSpec, url) => {
      writeSpec(nextSpec)
      setDataFileUrl(url)
    },
    onError: setError,
  })

  /** Points the spec at `url`; false when the spec is too broken to rewrite. */
  const pointSpecAtFile = (url: string): boolean => {
    const rewritten = specWithDataUrl(getCurrentSpec(), url)
    if (!rewritten) {
      setError(t("chart-data-file-ok-but-spec-invalid"))
      return false
    }
    setError(undefined)
    writeSpec(JSON.stringify(rewritten, null, 2))
    return true
  }

  return {
    error,
    isExtracting,
    extractedDataUrl,
    isDetached,
    restoreConfirmed,
    removeButtonRef,

    selectFile: (media) => {
      clearExtractedDataUrl()
      // Leave the file unattached when the spec can't be pointed at it, so the two never disagree.
      if (!pointSpecAtFile(media.url)) {
        return
      }
      setDataFileUrl(media.url)
      onFileAttached()
    },

    reportUploadError: (uploadError) => {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError))
    },

    removeFile: () => {
      // Drop a pending extraction: it would write a data file back into the spec being cleared.
      cancelScheduledExtraction()
      clearExtractedDataUrl()
      setDataFileUrl(undefined)
      let parsed: unknown
      try {
        parsed = JSON.parse(getCurrentSpec())
      } catch {
        return
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return
      }
      const { data: _omitted, ...specWithoutData } = parsed as Record<string, unknown>
      writeSpec(JSON.stringify(specWithoutData, null, 2))
    },

    reinsertFile: () => {
      if (!dataFileUrl || !pointSpecAtFile(dataFileUrl)) {
        return
      }
      // Synchronous, so focus moves before this button unmounts and the keyboard isn't dropped.
      removeButtonRef.current?.focus()
      confirmRestore()
    },

    scheduleExtraction,
  }
}
