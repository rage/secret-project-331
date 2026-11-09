"use client"

import { css, cx } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDebouncedCallback } from "use-debounce"

import {
  getCourseDesignerPlanQueryKey,
  setCourseDesignerGreatMoocVisionMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { getErrorMessage, TextArea } from "@/shared-module/components"

import { AUTOSAVE_DEBOUNCE_MS } from "../analysis-form/analysisFormDomain"

const statusStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
`

const errorStyles = css`
  color: ${baseTheme.colors.red[700]};
`

/** The plan's "vision of a great MOOC", saved automatically as the user types. */
export default function GreatMoocVisionField(props: {
  planId: string
  greatMoocVision: string | null | undefined
}) {
  const { planId, greatMoocVision } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
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
      await queryClient.invalidateQueries({
        queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
      })
    },
  })

  // Server changes replace the text only while there are no unsaved edits.
  useEffect(() => {
    if (getValues("vision") === lastSavedRef.current) {
      lastSavedRef.current = savedVision
      reset({ vision: savedVision })
    }
  }, [savedVision, getValues, reset])

  const debouncedSave = useDebouncedCallback((text: string) => {
    if (text === lastSavedRef.current) {
      return
    }
    mutation.mutate({
      path: { plan_id: planId },
      body: { great_mooc_vision: text.trim() === "" ? null : text },
    })
  }, AUTOSAVE_DEBOUNCE_MS)

  useEffect(() => {
    debouncedSave(vision)
  }, [vision, debouncedSave])

  const isUnsaved = vision !== lastSavedRef.current

  return (
    <>
      <TextArea
        name="vision"
        control={control}
        label={t("course-plans-mooc-design-vision-label")}
        description={t("course-plans-mooc-design-vision-description")}
        rows={5}
        autoResize
        maxLength={20000}
      />
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
    </>
  )
}
