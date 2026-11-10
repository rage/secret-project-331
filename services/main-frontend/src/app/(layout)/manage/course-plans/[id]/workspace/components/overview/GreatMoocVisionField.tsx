"use client"

import { css, cx } from "@emotion/css"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDebouncedCallback } from "use-debounce"

import { setCourseDesignerGreatMoocVisionMutation } from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { getErrorMessage, TextArea } from "@/shared-module/components"

import { useInvalidatePlan } from "../../../../hooks/useInvalidatePlan"
import { useRegisterPendingSave } from "../../../components/PendingSavesContext"
import { AUTOSAVE_DEBOUNCE_MS } from "../analysis-form/analysisFormDomain"

const statusStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
`

/** Matches the backend limit on the vision text. */
const MAX_VISION_CHARS = 10_000

const errorStyles = css`
  color: ${baseTheme.colors.red[700]};
`

/** The vision as it is stored: whitespace-only text is saved as no vision. */
function toSavedVision(text: string): string {
  return text.trim() === "" ? "" : text
}

/** The plan's "vision of a great MOOC", saved automatically as the user types. */
export default function GreatMoocVisionField(props: {
  planId: string
  greatMoocVision: string | null | undefined
  isReadOnly: boolean
}) {
  const { planId, greatMoocVision, isReadOnly } = props
  const { t } = useTranslation()
  const invalidatePlan = useInvalidatePlan(planId)
  const savedVision = greatMoocVision ?? ""
  const lastSavedRef = useRef(savedVision)
  const [hasSaved, setHasSaved] = useState(false)

  const { control, getValues, reset } = useForm<{ vision: string }>({
    defaultValues: { vision: savedVision },
  })
  const vision = useWatch({ control, name: "vision" })

  const mutation = useMutation({
    ...setCourseDesignerGreatMoocVisionMutation(),
    onSuccess: async (_plan, variables) => {
      lastSavedRef.current = variables.body.great_mooc_vision ?? ""
      setHasSaved(true)
      await invalidatePlan()
    },
  })

  // Server changes replace the text only while there are no unsaved edits.
  useEffect(() => {
    if (toSavedVision(getValues("vision")) === lastSavedRef.current) {
      lastSavedRef.current = savedVision
      reset({ vision: savedVision })
    }
  }, [savedVision, getValues, reset])

  const { mutateAsync } = mutation
  const saveNow = useCallback(async (): Promise<boolean> => {
    const text = toSavedVision(getValues("vision"))
    if (isReadOnly || text === lastSavedRef.current) {
      return true
    }
    try {
      await mutateAsync({
        path: { plan_id: planId },
        body: { great_mooc_vision: text === "" ? null : text },
      })
      return true
    } catch {
      return false
    }
  }, [getValues, isReadOnly, mutateAsync, planId])

  useRegisterPendingSave(saveNow)

  const debouncedSave = useDebouncedCallback(
    () => {
      void saveNow()
    },
    AUTOSAVE_DEBOUNCE_MS,
    { flushOnExit: true },
  )

  useEffect(() => {
    debouncedSave()
  }, [vision, debouncedSave])

  const isUnsaved = toSavedVision(vision) !== lastSavedRef.current

  return (
    <>
      <TextArea
        name="vision"
        control={control}
        label={t("course-plans-mooc-design-vision-label")}
        description={t("course-plans-mooc-design-vision-description")}
        rows={5}
        autoResize
        maxLength={MAX_VISION_CHARS}
        isDisabled={isReadOnly}
      />
      {isReadOnly ? null : (
        <p className={cx(statusStyles, mutation.isError && errorStyles)} role="status">
          {mutation.isPending
            ? t("course-plans-save-status-saving")
            : mutation.isError
              ? t("course-plans-save-status-error", { message: getErrorMessage(mutation.error) })
              : isUnsaved
                ? t("course-plans-save-status-unsaved")
                : hasSaved
                  ? t("course-plans-save-status-saved")
                  : t("course-plans-save-status-autosave")}
        </p>
      )}
    </>
  )
}
