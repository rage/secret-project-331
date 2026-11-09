"use client"

import { css } from "@emotion/css"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { setCourseDesignerSectionStatusMutation } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseDesignerSectionStatus,
  CourseDesignerStage,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, getErrorMessage, Radio, RadioGroup, TextArea } from "@/shared-module/components"

import { useInvalidatePlan } from "../../../../hooks/useInvalidatePlan"
import { useSectionStatuses } from "./SectionStatusContext"

const editorStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding: 0.85rem 1rem;
  border-radius: 0.5rem;
  border: 1px dashed ${baseTheme.colors.gray[300]};
  background: ${baseTheme.colors.clear[50]};
`

const actionRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`

const feedbackStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
`

const errorStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.red[700]};
  margin: 0;
`

interface SectionStatusFormValues {
  status: CourseDesignerSectionStatus | null
  comment: string
}

/**
 * Lets plan members mark a section Ready or Unfinished with an optional comment, shown at the end
 * of the section like a sign-off.
 */
export default function SectionStatusEditor(props: {
  stage: CourseDesignerStage
  sectionKey: string
}) {
  const { stage, sectionKey } = props
  const { t } = useTranslation()
  const { planId, findStatus } = useSectionStatuses()
  const invalidatePlan = useInvalidatePlan(planId)
  const savedStatus = findStatus(stage, sectionKey)
  const [savedJustNow, setSavedJustNow] = useState(false)

  const { control, handleSubmit, reset, formState } = useForm<SectionStatusFormValues>({
    defaultValues: { status: savedStatus?.status ?? null, comment: savedStatus?.comment ?? "" },
  })
  const status = useWatch({ control, name: "status" })

  useEffect(() => {
    reset({ status: savedStatus?.status ?? null, comment: savedStatus?.comment ?? "" })
  }, [savedStatus?.status, savedStatus?.comment, reset])

  useEffect(() => {
    if (formState.isDirty) {
      setSavedJustNow(false)
    }
  }, [formState.isDirty])

  const mutation = useMutation({
    ...setCourseDesignerSectionStatusMutation(),
    onSuccess: async () => {
      setSavedJustNow(true)
      await invalidatePlan()
    },
  })

  const onSubmit = (values: SectionStatusFormValues) => {
    if (values.status === null) {
      return
    }
    mutation.mutate({
      path: { plan_id: planId },
      body: {
        stage,
        section_key: sectionKey,
        status: values.status,
        comment: values.comment.trim() === "" ? null : values.comment,
      },
    })
  }

  return (
    // Not a <form>: it sits inside the stage's workspace form.
    <div className={editorStyles}>
      <RadioGroup
        name="status"
        control={control}
        variant="segmented"
        label={t("course-plans-section-status-question")}
        description={t("course-plans-section-status-description")}
      >
        <Radio value="Ready" label={t("course-plans-section-status-ready")} />
        <Radio value="Unfinished" label={t("course-plans-section-status-unfinished")} />
      </RadioGroup>
      <TextArea
        name="comment"
        control={control}
        label={t("course-plans-section-status-comment")}
        description={t("course-plans-section-status-comment-description")}
        rows={2}
        maxLength={2000}
      />
      <div className={actionRowStyles}>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => void handleSubmit(onSubmit)()}
          disabled={status === null || !formState.isDirty}
          isLoading={mutation.isPending}
        >
          {t("course-plans-section-status-save")}
        </Button>
        {mutation.isError ? (
          <p className={errorStyles} role="alert">
            {t("course-plans-section-status-save-error", {
              message: getErrorMessage(mutation.error),
            })}
          </p>
        ) : savedJustNow && !formState.isDirty ? (
          <p className={feedbackStyles} role="status">
            {t("course-plans-section-status-saved")}
          </p>
        ) : null}
      </div>
    </div>
  )
}
