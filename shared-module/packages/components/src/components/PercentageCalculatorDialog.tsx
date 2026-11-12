"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useLocale } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Dialog } from "./Dialog"
import { NumberField } from "./NumberField"

export interface PercentageCalculatorDialogProps {
  open: boolean
  onClose: () => void
  /** What the number is for, e.g. "Exercises attempted". */
  title: React.ReactNode
  /** Shown above the input, e.g. "This module has 42 exercises." */
  description?: React.ReactNode
  /** The count the percentage is taken of. */
  total: number
  /** Formats a count with its unit, e.g. `30` → "30 exercises", for the breakdown. */
  formatQuantity: (count: number) => string
  /** The unit as a bare plural noun, e.g. "exercises", as in "If you add exercises later". */
  unitPlural: string
  defaultPercentage?: number
  /** Receives the rounded-up count; the dialog does not close itself. */
  onUse: (count: number) => void
  "data-testid"?: string | undefined
}

interface PercentageFormValues {
  percentage: number | null
}

const MAX_FRACTION_DIGITS = 2
// A typed percentage is clamped, never snapped to the stepper's whole numbers.
const COMMIT_BEHAVIOR = "validate"
// Absorbs float error so that e.g. 50 % of 42 rounds to 21, not 22.
const ROUNDING_TOLERANCE = 1e-9

const descriptionCss = css`
  margin: 0 0 var(--space-4);
`

const breakdownCss = css`
  margin: var(--space-4) 0;
  padding: 0.875rem 1rem;
  border-left: 3px solid var(--color-blue-500);
  border-radius: 0 var(--surface-radius) var(--surface-radius) 0;
  background: var(--color-blue-25);

  &:empty {
    display: none;
  }
`

const noteCss = css`
  margin: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/** Rounds up so a requirement worked out from a percentage is never below that percentage. */
function percentageOfTotalRoundedUp(percentage: number, total: number): number {
  return Math.ceil((percentage / 100) * total - ROUNDING_TOLERANCE)
}

/**
 * Works out an exact count from a percentage of a total and shows the arithmetic, for settings
 * that store counts rather than percentages. Only the rounded-up count is passed to `onUse`.
 */
export const PercentageCalculatorDialog: React.FC<PercentageCalculatorDialogProps> = ({
  open,
  onClose,
  title,
  description,
  total,
  formatQuantity,
  unitPlural,
  defaultPercentage,
  onUse,
  "data-testid": dataTestId,
}) => {
  const { t } = useTranslation("shared-module")
  const { locale } = useLocale()
  const { control, reset, watch } = useForm<PercentageFormValues>({
    defaultValues: { percentage: defaultPercentage ?? null },
  })

  useEffect(() => {
    if (open) {
      reset({ percentage: defaultPercentage ?? null })
    }
  }, [open, defaultPercentage, reset])

  const enteredPercentage = watch("percentage")
  const percentage =
    enteredPercentage === null ? null : Math.min(100, Math.max(0, enteredPercentage))
  const rounded = percentage === null ? null : percentageOfTotalRoundedUp(percentage, total)
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: MAX_FRACTION_DIGITS }).format(value)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="small"
      data-testid={dataTestId}
      actions={[
        { label: t("button-cancel"), variant: "secondary", onPress: onClose },
        {
          label:
            rounded === null
              ? t("percentageCalculator.use")
              : t("percentageCalculator.useCount", { count: rounded }),
          variant: "primary",
          disabled: rounded === null,
          onPress: () => {
            if (rounded !== null) {
              onUse(rounded)
            }
          },
        },
      ]}
    >
      {description ? <p className={descriptionCss}>{description}</p> : null}
      <NumberField
        name="percentage"
        control={control}
        label={t("percentageCalculator.percentage")}
        unit="%"
        minValue={0}
        maxValue={100}
        commitBehavior={COMMIT_BEHAVIOR}
      />
      <div className={breakdownCss} aria-live="polite">
        {percentage === null || rounded === null
          ? null
          : t("percentageCalculator.breakdown", {
              percentage: format(percentage),
              total: format(total),
              totalQuantity: formatQuantity(total),
              fraction: format(percentage / 100),
              exact: format((percentage / 100) * total),
              roundedQuantity: formatQuantity(rounded),
            })}
      </div>
      {rounded === null ? null : (
        <p className={noteCss}>
          {t("percentageCalculator.onlyCountSaved", { count: rounded, unitPlural })}
        </p>
      )}
    </Dialog>
  )
}
