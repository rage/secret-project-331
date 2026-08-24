"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
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
  onSubmit: (decision: NewTeacherGradingDecision) => void
  /** Dialog shell passes its close handler; inline shell omits it (resets the form instead). */
  onCancel?: () => void
}

const formCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const pointsRowCss = css`
  display: flex;
  align-items: flex-end;
  gap: 1rem;
`

const sliderColumnCss = css`
  flex: 1;
`

const presetsRowCss = css`
  display: flex;
  gap: 0.5rem;
`

const footerCss = css`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`

// oxlint-disable-next-line i18next/no-literal-string
const horizontalOrientation = "horizontal" as const
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
  const { t } = useTranslation()

  const { control, handleSubmit, watch, setValue, reset } = useForm<GradingDecisionFormValues>({
    // oxlint-disable-next-line i18next/no-literal-string
    defaultValues: { mode: "award-points", points: 0, feedback: "" },
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  const mode = watch("mode")
  const points = watch("points")
  const action = resolveAction(mode, points, target.exerciseMaxPoints)
  const isFullPoints = action === "FullPoints"

  const onValidSubmit = (values: GradingDecisionFormValues) => {
    onSubmit(buildGradingDecision(values, target))
    if (layout === "inline") {
      reset()
    }
  }

  return (
    <form className={formCss} onSubmit={handleSubmit(onValidSubmit)}>
      <RadioGroup
        name="mode"
        control={control}
        label={t("label-grading-decision")}
        orientation={layout === "inline" ? horizontalOrientation : verticalOrientation}
      >
        {availableModes.map((availableMode) => (
          <Radio
            key={availableMode}
            value={availableMode}
            label={modeLabel(t, availableMode)}
            description={modeDescription(t, availableMode)}
          />
        ))}
      </RadioGroup>

      {mode === "reject-and-reset" && rejectWarning ? (
        <Infobox tone={warningTone}>{rejectWarning}</Infobox>
      ) : null}

      {mode === "award-points" && (
        <div className={pointsRowCss}>
          <div className={sliderColumnCss}>
            <Slider
              name="points"
              control={control}
              label={t("points")}
              minValue={0}
              maxValue={target.exerciseMaxPoints}
              step={0.1}
              marks={[0, target.exerciseMaxPoints]}
            />
          </div>
          <NumberField
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
          <div className={presetsRowCss}>
            <Button
              type="button"
              variant="secondary"
              size="medium"
              onClick={() => setValue("points", 0, { shouldDirty: true, shouldValidate: true })}
            >
              {t("button-text-zero-points")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="medium"
              onClick={() =>
                setValue("points", target.exerciseMaxPoints, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              {t("button-text-full-points")}
            </Button>
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
        {layout === "dialog" && (
          <Button type="button" variant="secondary" size="medium" onClick={() => onCancel?.()}>
            {t("button-text-cancel")}
          </Button>
        )}
        <Button type="submit" variant="primary" size="medium" disabled={isSubmitting}>
          {t("button-text-save-grading-decision")}
        </Button>
      </div>
    </form>
  )
}
