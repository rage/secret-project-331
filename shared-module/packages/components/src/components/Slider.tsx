"use client"

import { css, cx } from "@emotion/css"
import { useSliderState } from "@react-stately/slider"
import React, { useMemo, useRef } from "react"
import {
  mergeProps,
  useFocusRing,
  useLocale,
  useSlider,
  useSliderThumb,
  VisuallyHidden,
} from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { composeRefs } from "../lib/utils/compositeField"
import { resolveFieldDescribedBy } from "../lib/utils/field"
import { includeIf, omitUndefined } from "../lib/utils/nullability"
import { FieldShell } from "./primitives/FieldShell"
import type { FieldSize } from "./primitives/fieldStyles"

// oxlint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

const rootCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
`

const labelRowCss = css`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  width: 100%;
`

const valueOutputCss = css`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-gray-700);
`

const trackRowCss = css`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 1.5rem;
  padding: 0 0.625rem;
`

const trackLineCss = css`
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--color-gray-100);
`

const fillCss = css`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: var(--color-blue-500);
`

const markCss = css`
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--color-gray-300);
  transform: translateX(-1px);
`

const thumbSizePx: Record<FieldSize, number> = {
  sm: 18,
  md: 20,
  lg: 24,
}

const thumbCss = css`
  position: absolute;
  top: 50%;
  border-radius: 50%;
  background: var(--color-clear-50);
  box-shadow:
    0 0 0 1px var(--color-gray-400),
    0 1px 2px rgba(0, 0, 0, 0.15);
  transform: translate(-50%, -50%);
  cursor: grab;
  touch-action: none;

  &[data-dragging="true"] {
    cursor: grabbing;
  }

  &[data-focus-visible="true"] {
    outline: none;
    box-shadow:
      0 0 0 1px var(--color-blue-500),
      0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }

  &[data-disabled="true"] {
    background: var(--field-bg-disabled);
    box-shadow: 0 0 0 1px var(--field-disabled-border);
    cursor: not-allowed;
  }
`

/**
 * Single-thumb slider with label, description, and error display.
 * Uses react-hook-form; pass `name` and `control`. Form value is `number`.
 *
 * Dragging/keyboard snaps to `step`; a value set outside that grid (e.g. by a linked
 * `NumberField` bound to the same field) renders at the nearest step position, but the
 * form value itself is only overwritten by an actual drag/keyboard interaction — never
 * by a passive re-render — so precision typed elsewhere survives until the user
 * touches this control.
 *
 * @example
 * <Slider name="points" control={control} label="Points" minValue={0} maxValue={10} step={0.1} />
 */
export type SliderProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isRequired?: boolean
  id?: string
  minValue?: number
  maxValue: number
  step?: number
  formatOptions?: Intl.NumberFormatOptions
  /** Renders the formatted current value next to the label. Default true. */
  showValueLabel?: boolean
  /** Marker positions rendered as ticks on the track, e.g. `[0, maxValue]`. */
  marks?: readonly number[]
  "aria-label"?: string
  className?: string
}

export function Slider<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: SliderProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    isDisabled = false,
    isRequired = false,
    id,
    minValue = 0,
    maxValue,
    step = 1,
    formatOptions,
    showValueLabel = true,
    marks,
    className,
    "aria-label": ariaLabel,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const { locale } = useLocale()
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale, formatOptions),
    [locale, formatOptions],
  )

  const trackRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const numericValue =
    typeof field.value === "number" && !Number.isNaN(field.value) ? field.value : minValue

  const state = useSliderState({
    numberFormatter,
    minValue,
    maxValue,
    step,
    isDisabled,
    value: [numericValue],
    onChange: ([value]) => {
      field.onChange(value)
    },
    onChangeEnd: () => {
      field.onBlur()
    },
  })

  const descriptionId = React.useId()
  const errorMessageId = React.useId()
  const describedBy = resolveFieldDescribedBy({
    descriptionId,
    errorMessageId,
    hasDescription: Boolean(description),
    hasErrorMessage: Boolean(resolvedError),
  })

  const { groupProps, trackProps, labelProps, outputProps } = useSlider(
    {
      label,
      minValue,
      maxValue,
      step,
      isDisabled,
      ...omitUndefined({ id, "aria-label": ariaLabel }),
    },
    state,
    trackRef,
  )

  const { thumbProps, inputProps, isDragging, isFocused } = useSliderThumb(
    {
      index: 0,
      trackRef,
      inputRef,
      isDisabled,
      ...omitUndefined({ "aria-describedby": describedBy }),
    },
    state,
  )

  const { focusProps, isFocusVisible } = useFocusRing()

  const thumbPercent = state.getThumbPercent(0) * 100

  return (
    <FieldShell
      className={cx(rootCss, className)}
      description={description}
      {...includeIf(description, { descriptionId })}
      errorMessage={resolvedError}
      {...includeIf(resolvedError, { errorMessageId })}
      isDisabled={isDisabled}
      isRequired={isRequired}
      layout={stackedLayout}
    >
      <div {...groupProps}>
        <div className={labelRowCss}>
          <label {...labelProps}>
            {label}
            {isRequired ? " *" : null}
          </label>
          {showValueLabel ? (
            <output {...outputProps} className={valueOutputCss}>
              {state.getThumbValueLabel(0)}
            </output>
          ) : null}
        </div>
        <div className={trackRowCss}>
          <div {...trackProps} ref={trackRef} className={trackLineCss}>
            <div
              className={cx(
                fillCss,
                css`
                  width: ${thumbPercent}%;
                `,
              )}
              aria-hidden="true"
            />
            {marks?.map((mark) => (
              <span
                key={mark}
                className={cx(
                  markCss,
                  css`
                    left: ${state.getValuePercent(mark) * 100}%;
                  `,
                )}
                aria-hidden="true"
              />
            ))}
            <div
              {...thumbProps}
              className={cx(
                thumbCss,
                css`
                  left: ${thumbPercent}%;
                  width: ${thumbSizePx[fieldSize]}px;
                  height: ${thumbSizePx[fieldSize]}px;
                `,
              )}
              data-dragging={isDragging ? "true" : "false"}
              data-focus-visible={isFocusVisible && isFocused ? "true" : "false"}
              data-disabled={isDisabled ? "true" : "false"}
            >
              <VisuallyHidden>
                <input
                  {...mergeProps(inputProps, focusProps)}
                  ref={composeRefs(inputRef, field.ref)}
                  onBlur={(e) => {
                    inputProps.onBlur?.(e)
                    field.onBlur()
                  }}
                  aria-invalid={isInvalid ? "true" : undefined}
                />
              </VisuallyHidden>
            </div>
          </div>
        </div>
      </div>
    </FieldShell>
  )
}
