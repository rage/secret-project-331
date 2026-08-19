"use client"

import { css } from "@emotion/css"
import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import Button from "@/shared-module/common/components/Button"
import type { ButtonProps } from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

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
  const [points, setPoints] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)

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

  const reset = useCallback(() => {
    setOpen(false)
    setPoints(0)
    setFeedback("")
  }, [])

  const handleOpenPopup = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    setOpen((prev) => !prev)
  }, [])

  const handleCancel = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      reset()
    },
    [reset],
  )

  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPoints(Number(event.target.value))
  }, [])

  const handleSubmitAndClose = useCallback(() => {
    onSubmit({
      points: pointsSlider ? points : null,
      justification: feedback.trim() === "" ? null : feedback.trim(),
    })
    reset()
  }, [onSubmit, points, feedback, pointsSlider, reset])

  const isSubmitDisabled =
    pointsSlider !== undefined &&
    (points > pointsSlider.exerciseMaxPoints ||
      points < 0 ||
      // Limit to 2 decimal places
      !Number.isInteger(points * 100))

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
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            `}
          >
            {pointsSlider && (
              <div
                className={css`
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                `}
              >
                <input
                  className={css`
                    flex: 1;
                    height: 0.375rem;
                    -webkit-appearance: none;
                    background: ${baseTheme.colors.clear[200]};
                    border-radius: 0.1875rem;
                    outline: none;
                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 1.125rem;
                      height: 1.125rem;
                      background: ${baseTheme.colors.blue[500]};
                      border-radius: 50%;
                      cursor: pointer;
                    }
                  `}
                  type="range"
                  min="0"
                  max={pointsSlider.exerciseMaxPoints}
                  step={0.1}
                  value={points}
                  onChange={handleSliderChange}
                  aria-label={t("points")}
                />
                <input
                  className={css`
                    width: 5rem;
                    padding: 0.5rem 0.75rem;
                    border: 0.0625rem solid ${baseTheme.colors.clear[200]};
                    border-radius: 0.25rem;
                    font-size: 1rem;
                    text-align: center;
                  `}
                  value={points}
                  onChange={handleSliderChange}
                  min="0.0"
                  step={0.1}
                  max={pointsSlider.exerciseMaxPoints}
                  type="number"
                  aria-label={t("points")}
                />
              </div>
            )}
            <TextAreaField
              label={t("label-feedback-for-student-optional")}
              value={feedback}
              onChangeByValue={setFeedback}
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
              <Button
                type="button"
                variant={variant}
                size="medium"
                disabled={isSubmitDisabled}
                onClick={handleSubmitAndClose}
              >
                {/* Distinct from triggerLabel, matching CustomPointsPopup's trigger/submit split. */}
                {pointsSlider ? t("button-text-give-custom-points") : triggerLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default TeacherDecisionFeedbackPopup
