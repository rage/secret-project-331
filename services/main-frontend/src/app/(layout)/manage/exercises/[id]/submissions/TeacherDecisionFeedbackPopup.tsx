"use client"

import { css } from "@emotion/css"
import React, { useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import Button from "@/shared-module/common/components/Button"
import type { ButtonProps } from "@/shared-module/common/components/Button"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { NumberField, TextArea } from "@/shared-module/components"

export interface TeacherDecisionFeedbackResult {
  points: number | null
  justification: string | null
}

interface TeacherDecisionFeedbackPopupProps {
  triggerLabel: string
  variant: ButtonProps["variant"]
  /** Present only for decisions that need a manual points value, e.g. CustomPoints. */
  pointsSlider?: { exerciseMaxPoints: number }
  onSubmit: (result: TeacherDecisionFeedbackResult) => void
}

interface FeedbackFormValues {
  points: number | null
  feedback: string
}

/**
 * Shared popup for teacher grading decisions that award less than full points
 * (ZeroPoints, CustomPoints, SuspectedPlagiarism, RejectAndReset). Always lets
 * the teacher attach an optional feedback text; only shows a points input when
 * `pointsSlider` is given.
 */
const TeacherDecisionFeedbackPopup: React.FC<TeacherDecisionFeedbackPopupProps> = ({
  triggerLabel,
  variant,
  pointsSlider,
  onSubmit,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)

  const {
    control,
    handleSubmit,
    reset: resetForm,
    formState: { isValid },
  } = useForm<FeedbackFormValues>({
    defaultValues: { points: 0, feedback: "" },
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom",
    modifiers: [
      { name: "arrow", options: { element: arrowElement, padding: 10 } },
      { name: "offset", options: { offset: [0, 20] } },
      {
        name: "preventOverflow",
        options: { padding: 8, boundary: "clippingParents", altAxis: true },
      },
    ],
  })

  const closeAndReset = useCallback(() => {
    setOpen(false)
    resetForm()
  }, [resetForm])

  const handleOpenPopup = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    setOpen((prev) => !prev)
  }, [])

  const handleCancel = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      closeAndReset()
    },
    [closeAndReset],
  )

  const onValidSubmit = useCallback(
    (fields: FeedbackFormValues) => {
      onSubmit({
        points: pointsSlider ? fields.points : null,
        justification: fields.feedback.trim() === "" ? null : fields.feedback.trim(),
      })
      closeAndReset()
    },
    [onSubmit, pointsSlider, closeAndReset],
  )

  const isSubmitDisabled = pointsSlider !== undefined && !isValid

  return (
    <>
      <Button
        className={css`
          font-family: ${primaryFont};
          font-weight: 600;
          font-size: 16px;
        `}
        size="medium"
        variant={variant}
        type="button"
        ref={setReferenceElement}
        onClick={handleOpenPopup}
      >
        {triggerLabel}
      </Button>
      {open && (
        <div
          ref={setPopperElement}
          className={css`
            background-color: ${baseTheme.colors.primary[100]};
            padding: 1.5rem;
            z-index: 5;
            border-radius: 0.5rem;
            box-shadow: 0 0.25rem 1.25rem ${baseTheme.colors.gray[700]}26;
            min-width: 18.75rem;
          `}
          // oxlint-disable-next-line react/forbid-dom-props
          style={styles.popper}
          {...attributes.popper}
        >
          {/* oxlint-disable-next-line react/forbid-dom-props */}
          <div ref={setArrowElement} style={styles.arrow} />
          <form
            onSubmit={handleSubmit(onValidSubmit)}
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            `}
          >
            {pointsSlider && (
              <NumberField
                name="points"
                control={control}
                label={t("points")}
                minValue={0}
                maxValue={pointsSlider.exerciseMaxPoints}
                step={0.1}
                rules={{
                  validate: (value) =>
                    value !== null &&
                    value >= 0 &&
                    value <= pointsSlider.exerciseMaxPoints &&
                    // Limit to 2 decimal places
                    Number.isInteger(value * 100)
                      ? true
                      : t("points-out-of-range", { max: pointsSlider.exerciseMaxPoints }),
                }}
              />
            )}
            <TextArea
              name="feedback"
              control={control}
              label={t("label-feedback-for-student-optional")}
              placeholder={t("placeholder-teacher-feedback-for-student")}
            />
            <div
              className={css`
                display: flex;
                justify-content: flex-end;
                gap: 0.8rem;
              `}
            >
              <Button type="button" variant="white" size="medium" onClick={handleCancel}>
                {t("button-text-cancel")}
              </Button>
              <Button type="submit" variant={variant} size="medium" disabled={isSubmitDisabled}>
                {/* Distinct from triggerLabel, matching CustomPointsPopup's trigger/submit split. */}
                {pointsSlider ? t("button-text-give-custom-points") : triggerLabel}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export default TeacherDecisionFeedbackPopup
