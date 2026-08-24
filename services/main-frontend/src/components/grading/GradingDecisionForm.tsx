"use client"

import { css } from "@emotion/css"
import { ArrowLeft, Flag } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"
import {
  Button,
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
  type GradingMode,
  type GradingTarget,
  resolveAction,
} from "./gradingDecision"

interface GradingDecisionFormProps {
  target: GradingTarget
  /** Always includes "award-points"; call sites drop modes that don't apply in their context. */
  availableModes: readonly GradingMode[]
  /** Shown when the selected mode is "reject-and-reset". */
  rejectWarning?: React.ReactNode
  layout: "inline" | "dialog"
  isSubmitting?: boolean
  onSubmit: (decision: NewTeacherGradingDecision) => void | Promise<void>
  /** Dialog shell passes its close handler; inline shell omits it (resets the form instead). */
  onCancel?: () => void
}

const formCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

const pointsBlockCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const pointsFieldCss = css`
  width: 9rem;
`

const trackCss = css`
  /* The number field above already labels this control; a second visible "Points" would
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

const scaleCss = css`
  display: flex;
  justify-content: space-between;
  /* Matches the slider track's own thumb inset so the endpoints line up with the track ends. */
  padding: 0 0.625rem;
  margin-top: 0.25rem;
  font-size: var(--font-size-1);
  font-variant-numeric: tabular-nums;
  color: var(--color-gray-400);
`

const flagLaneCss = css`
  padding: 1rem;
  border-left: 3px solid var(--color-crimson-600);
  border-radius: 0 var(--control-radius) var(--control-radius) 0;
  background: var(--color-crimson-50);
`

const flagOptionsCss = css`
  gap: 0.625rem;

  /* The options are cards rather than bare rows, so they need more air than the
     group's default 4px row gap. The legend is always followed by the option list. */
  & legend + div {
    gap: 0.5rem;
  }
`

const flagOptionCss = css`
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--color-clear-400);
  border-radius: var(--control-radius);
  background: var(--color-clear-50);
  transition: border-color 160ms ease;

  &:hover {
    border-color: var(--color-gray-300);
  }

  &:has(input:checked) {
    border-color: var(--color-crimson-600);
  }
`

const footerCss = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
`

const footerActionsCss = css`
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
`

// oxlint-disable-next-line i18next/no-literal-string
const awardPoints = "award-points" as const
// oxlint-disable-next-line i18next/no-literal-string
const verticalOrientation = "vertical" as const
// oxlint-disable-next-line i18next/no-literal-string
const warningTone = "warning" as const

function modeLabel(t: TFunction, mode: GradingMode): string {
  switch (mode) {
    case "award-points":
      return t("label-decision-award-points")
    case "reject-and-reset":
      return t("button-text-reject-and-reset")
    case "suspected-plagiarism":
      return t("button-text-suspected-plagiarism")
    case "unauthorized-ai-use":
      return t("button-text-suspected-unauthorized-ai-use")
  }
}

function modeDescription(t: TFunction, mode: GradingMode): string {
  switch (mode) {
    case "award-points":
      return t("description-decision-award-points")
    case "reject-and-reset":
      return t("description-decision-reject-and-reset")
    case "suspected-plagiarism":
      return t("description-decision-suspected-plagiarism")
    case "unauthorized-ai-use":
      return t("description-decision-unauthorized-ai-use")
  }
}

export const GradingDecisionForm: React.FC<GradingDecisionFormProps> = ({
  target,
  availableModes,
  rejectWarning,
  layout,
  isSubmitting = false,
  onSubmit,
  onCancel,
}) => {
  const { t, i18n } = useTranslation()
  const scaleFormatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  const { control, handleSubmit, watch, setValue, reset } = useForm<GradingDecisionFormValues>({
    defaultValues: { mode: awardPoints, points: 0, feedback: "" },
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  const mode = watch("mode")
  const points = watch("points")
  const action = resolveAction(mode, points, target.exerciseMaxPoints)
  const isFullPoints = action === "FullPoints"

  const flagModes = availableModes.filter((availableMode) => availableMode !== awardPoints)
  const firstFlagMode = flagModes[0]
  const isFlagging = mode !== awardPoints

  const switchMode = (nextMode: GradingMode) => {
    setValue("mode", nextMode, { shouldDirty: true, shouldValidate: true })
  }

  const onValidSubmit = (values: GradingDecisionFormValues) => {
    onSubmit(buildGradingDecision(values, target))
    if (layout === "inline") {
      reset()
    }
  }

  return (
    <form className={formCss} onSubmit={handleSubmit(onValidSubmit)}>
      {isFlagging ? (
        <div className={flagLaneCss}>
          <RadioGroup
            className={flagOptionsCss}
            name="mode"
            control={control}
            label={t("label-what-is-wrong-with-this-answer")}
            orientation={verticalOrientation}
          >
            {flagModes.map((flagMode) => (
              <Radio
                key={flagMode}
                className={flagOptionCss}
                value={flagMode}
                label={modeLabel(t, flagMode)}
                description={modeDescription(t, flagMode)}
              />
            ))}
          </RadioGroup>
          {mode === "reject-and-reset" && rejectWarning ? (
            <Infobox tone={warningTone}>{rejectWarning}</Infobox>
          ) : null}
        </div>
      ) : (
        <div className={pointsBlockCss}>
          <NumberField
            className={pointsFieldCss}
            name="points"
            control={control}
            label={t("points")}
            minValue={0}
            maxValue={target.exerciseMaxPoints}
            step={0.1}
            rules={{
              validate: (value) =>
                value !== null &&
                value >= 0 &&
                value <= target.exerciseMaxPoints &&
                // Limit to 2 decimal places
                Number.isInteger(value * 100)
                  ? true
                  : t("points-out-of-range", { max: target.exerciseMaxPoints }),
            }}
          />
          <div>
            <Slider
              className={trackCss}
              name="points"
              control={control}
              label={t("points")}
              minValue={0}
              maxValue={target.exerciseMaxPoints}
              step={0.1}
              showValueLabel={false}
            />
            <div className={scaleCss} aria-hidden="true">
              <span>{scaleFormatter.format(0)}</span>
              <span>{scaleFormatter.format(target.exerciseMaxPoints)}</span>
            </div>
          </div>
        </div>
      )}

      <TextArea
        name="feedback"
        control={control}
        label={t("label-feedback-for-student-optional")}
        placeholder={t("placeholder-teacher-feedback-for-student")}
        isDisabled={isFullPoints}
        description={isFullPoints ? t("notification-full-points-feedback-not-shown") : undefined}
      />

      <div className={footerCss}>
        {isFlagging ? (
          <Button
            type="button"
            variant="tertiary"
            size="small"
            icon={<ArrowLeft size={14} />}
            onClick={() => switchMode(awardPoints)}
          >
            {t("button-text-back-to-awarding-points")}
          </Button>
        ) : firstFlagMode !== undefined ? (
          <Button
            type="button"
            variant="tertiary"
            size="small"
            icon={<Flag size={14} />}
            onClick={() => switchMode(firstFlagMode)}
          >
            {t("button-text-flag-this-answer")}
          </Button>
        ) : null}
        <div className={footerActionsCss}>
          {layout === "dialog" && (
            <Button type="button" variant="secondary" size="medium" onClick={() => onCancel?.()}>
              {t("button-text-cancel")}
            </Button>
          )}
          <Button type="submit" variant="primary" size="medium" disabled={isSubmitting}>
            {t("button-text-save-grading-decision")}
          </Button>
        </div>
      </div>
    </form>
  )
}
