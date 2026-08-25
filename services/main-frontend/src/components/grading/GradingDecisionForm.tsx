"use client"

import { css } from "@emotion/css"
import { ArrowLeftLine, ArrowRightLine } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"
import {
  Button,
  Checkbox,
  Infobox,
  NumberField,
  Radio,
  RadioGroup,
  Slider,
  TextArea,
} from "@/shared-module/components"

import {
  buildGradingDecision,
  type GradingDecisionFormValues,
  type GradingReason,
  type GradingTarget,
  isZeroPoints,
  resolveAction,
} from "./gradingDecision"

interface GradingDecisionFormProps {
  target: GradingTarget
  /** False in exam contexts: resetting an exercise requires a course (see teacher_grading_decisions.rs). */
  canResetExercise: boolean
  /** Shown when the teacher asks to let the student answer again. */
  rejectWarning?: React.ReactNode
  isSubmitting?: boolean
  onSubmit: (decision: NewTeacherGradingDecision) => void | Promise<void>
}

const REASONS: readonly GradingReason[] = [
  "bad-answer",
  "plagiarism",
  "unauthorized-ai-use",
  "other",
]

const formCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

/* Row one is arrow / track / arrow / number field; the scale sits on row two under the track
   alone, so the arrows and the field stay aligned with the track itself. */
const pointsGridCss = css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 0.5rem;
`

const pointsFieldCss = css`
  width: 6rem;
  margin-left: 0.75rem;
`

/* The icon variant's muted grey is too faint for a 2px-stroke glyph this small. */
const arrowButtonCss = css`
  --btn-icon-fg: var(--color-gray-700);
  --btn-icon-fg-hover: var(--color-green-700);
`

const scaleCss = css`
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  /* Matches the slider track's own thumb inset so the endpoints line up with the track ends. */
  padding: 0 0.625rem;
  font-size: var(--font-size-1);
  font-variant-numeric: tabular-nums;
  color: var(--color-gray-400);
`

const trackCss = css`
  /* The number field beside it already labels this control; a second visible "Points" would
     just repeat it, so the slider keeps its label for assistive tech only. */
  & label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`

const reasonGroupCss = css`
  /* A <legend> is not laid out as a grid item, so the fieldset's own gap never reaches it. */
  & legend {
    margin-bottom: 1rem;
  }

  /* The options are cards rather than bare rows, so they need more air than the
     group's default 4px row gap. The legend is always followed by the option list. */
  & legend + div {
    gap: 0.5rem;
  }
`

const reasonCss = css`
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--color-clear-400);
  border-radius: var(--control-radius);
  background: var(--color-clear-50);
  transition: border-color 160ms ease;

  &:hover {
    border-color: var(--color-gray-300);
  }

  &:has(input:checked) {
    border-color: var(--color-green-600);
  }
`

const resetBlockCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-crimson-200);
  border-radius: var(--control-radius);
  background: var(--color-crimson-50);
`

const footerCss = css`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`

// oxlint-disable-next-line i18next/no-literal-string
const badAnswer = "bad-answer" as const
// oxlint-disable-next-line i18next/no-literal-string
const verticalOrientation = "vertical" as const
// oxlint-disable-next-line i18next/no-literal-string
const warningTone = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const validateOnCommit = "validate" as const

/** Keeps dragging practical on high-point exercises; the number field still takes any value. */
function sliderStep(exerciseMaxPoints: number): number {
  if (exerciseMaxPoints > 10) {
    return 1
  }
  if (exerciseMaxPoints > 5) {
    return 0.5
  }
  return 0.1
}

function reasonLabel(t: TFunction, reason: GradingReason): string {
  switch (reason) {
    case "bad-answer":
      return t("label-reason-bad-answer")
    case "plagiarism":
      return t("label-reason-plagiarism")
    case "unauthorized-ai-use":
      return t("label-reason-unauthorized-ai-use")
    case "other":
      return t("label-reason-other")
  }
}

function reasonDescription(t: TFunction, reason: GradingReason): string {
  switch (reason) {
    case "bad-answer":
      return t("description-reason-bad-answer")
    case "plagiarism":
      return t("description-reason-plagiarism")
    case "unauthorized-ai-use":
      return t("description-reason-unauthorized-ai-use")
    case "other":
      return t("description-reason-other")
  }
}

export const GradingDecisionForm: React.FC<GradingDecisionFormProps> = ({
  target,
  canResetExercise,
  rejectWarning,
  isSubmitting = false,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation()
  const pointsFormatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  const { control, handleSubmit, watch, setValue } = useForm<GradingDecisionFormValues>({
    defaultValues: {
      points: target.exerciseMaxPoints,
      reason: badAnswer,
      resetExercise: false,
      feedback: "",
    },
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  const points = watch("points")
  const reason = watch("reason")
  const resetExercise = watch("resetExercise")
  // Both reveals follow the decision the form would submit, so an exercise worth zero points
  // can't hide the feedback field while still recording a reason.
  const action = resolveAction(points, reason, target.exerciseMaxPoints)
  const isZero = isZeroPoints(points)

  const setPoints = (value: number) => {
    setValue("points", value, { shouldDirty: true, shouldValidate: true })
  }

  // Deliberately not resetting: the inline shell greys the card out and leaves it in place so a
  // misclick can be spotted, which only works while the form still shows what was submitted.
  const onValidSubmit = (values: GradingDecisionFormValues) => {
    onSubmit(buildGradingDecision(values, target))
  }

  return (
    <form className={formCss} onSubmit={handleSubmit(onValidSubmit)}>
      <div className={pointsGridCss}>
        <Button
          type="button"
          variant="icon"
          size="small"
          className={arrowButtonCss}
          icon={<ArrowLeftLine size={20} weight="bold" />}
          aria-label={t("label-set-points-to", { points: 0 })}
          onClick={() => setPoints(0)}
        />
        <Slider
          className={trackCss}
          name="points"
          control={control}
          label={t("points")}
          minValue={0}
          maxValue={target.exerciseMaxPoints}
          step={sliderStep(target.exerciseMaxPoints)}
          showValueLabel={false}
        />
        <Button
          type="button"
          variant="icon"
          size="small"
          className={arrowButtonCss}
          icon={<ArrowRightLine size={20} weight="bold" />}
          aria-label={t("label-set-points-to", { points: target.exerciseMaxPoints })}
          onClick={() => setPoints(target.exerciseMaxPoints)}
        />
        <NumberField
          className={pointsFieldCss}
          name="points"
          control={control}
          label={t("points")}
          minValue={0}
          maxValue={target.exerciseMaxPoints}
          step={0.1}
          // The step only sizes the stepper buttons here; snapping to it would quietly turn a
          // typed 0.75 into 0.7, which the rule below explicitly allows.
          commitBehavior={validateOnCommit}
          rules={{
            validate: (value) =>
              value !== null &&
              value >= 0 &&
              value <= target.exerciseMaxPoints &&
              Number.isInteger(value * 100)
                ? true
                : t("points-out-of-range", { max: target.exerciseMaxPoints }),
          }}
        />
        <div className={scaleCss} aria-hidden="true">
          <span>{pointsFormatter.format(0)}</span>
          <span>{pointsFormatter.format(target.exerciseMaxPoints)}</span>
        </div>
      </div>

      {isZero && (
        <>
          <RadioGroup
            className={reasonGroupCss}
            name="reason"
            control={control}
            label={t("label-what-is-wrong-with-this-answer")}
            orientation={verticalOrientation}
          >
            {REASONS.map((option) => (
              <Radio
                key={option}
                className={reasonCss}
                value={option}
                label={reasonLabel(t, option)}
                description={reasonDescription(t, option)}
              />
            ))}
          </RadioGroup>

          {canResetExercise && (
            <div className={resetBlockCss}>
              <Checkbox
                name="resetExercise"
                control={control}
                label={t("label-reset-answer")}
                description={t("description-reset-answer")}
              />
              {resetExercise && rejectWarning ? (
                <Infobox tone={warningTone}>{rejectWarning}</Infobox>
              ) : null}
            </div>
          )}
        </>
      )}

      {action !== "FullPoints" && (
        <TextArea
          name="feedback"
          control={control}
          label={t("label-feedback-for-student-optional")}
          placeholder={t("placeholder-teacher-feedback-for-student")}
        />
      )}

      <div className={footerCss}>
        <Button type="submit" variant="primary" size="medium" disabled={isSubmitting}>
          {t("button-text-save-grading-decision")}
        </Button>
      </div>
    </form>
  )
}
