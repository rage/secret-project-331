"use client"

import { useEffect } from "react"
import { type Control, useForm } from "react-hook-form"

interface CaptionChange {
  caption: string
  /** The spec rewritten with a matching `description`; absent when it already said this. */
  spec?: string
}

interface ChartCaptionFieldOptions {
  /** The caption stored on the block. */
  caption: string
  /** The spec as it currently stands, including edits not yet flushed to the attributes. */
  getCurrentSpec: () => string
  onCaptionChange: (change: CaptionChange) => void
}

/** The spec with its `description` set to the caption, or null if it doesn't need changing. */
const specWithDescription = (specString: string, caption: string): string | null => {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(specString)
  } catch {
    // Spec isn't valid JSON right now; only the caption can change.
    return null
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null
  }
  const wanted = caption.trim() ? caption : undefined
  const current = typeof parsed.description === "string" ? parsed.description : undefined
  // Notably this skips the echo of a caption a spec edit just synced, where re-serializing would
  // replace the JSON editor's document under the teacher's caret.
  if (current === wanted) {
    return null
  }
  if (wanted) {
    parsed.description = wanted
  } else {
    delete parsed.description
  }
  return JSON.stringify(parsed, null, 2)
}

/**
 * The caption text field, which mirrors the spec's `description`: editing either one updates the
 * other, and the last edit wins.
 */
export const useChartCaptionField = ({
  caption,
  getCurrentSpec,
  onCaptionChange,
}: ChartCaptionFieldOptions): { control: Control<{ caption: string }> } => {
  const { control, watch, getValues, setValue } = useForm<{ caption: string }>({
    defaultValues: { caption },
  })

  // Attribute -> field: a spec edit syncing its `description` into the caption.
  useEffect(() => {
    if (caption !== getValues("caption")) {
      setValue("caption", caption)
    }
  }, [caption, getValues, setValue])

  // Field -> attribute: the teacher typing in the caption field. Re-subscribed every render so the
  // callback never closes over a stale onCaptionChange.
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name !== "caption") {
        return
      }
      const nextCaption = values.caption ?? ""
      const nextSpec = specWithDescription(getCurrentSpec(), nextCaption)
      onCaptionChange({ caption: nextCaption, ...(nextSpec === null ? {} : { spec: nextSpec }) })
    })
    return () => subscription.unsubscribe()
  })

  return { control }
}
