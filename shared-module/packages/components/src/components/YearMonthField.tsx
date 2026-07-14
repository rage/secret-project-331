"use client"

/* oxlint-disable i18next/no-literal-string */

import { css, cx } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React, { useId, useRef, useState } from "react"
import { mergeProps, useButton, useDateFormatter, useOverlayTrigger } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { parseYearMonth, serializeYearMonth } from "../lib/utils/yearMonth"

import { FieldShell } from "./primitives/FieldShell"
import { YearMonthPicker } from "./primitives/YearMonthPicker"
import type { FieldSize } from "./primitives/fieldStyles"
import {
  resolveSelectLabelCss,
  resolveSelectTriggerCss,
  selectTriggerValuePlaceholderCss,
} from "./primitives/fieldStyles"
import { Popover } from "./primitives/popover"
import { comboChevronCss } from "./primitives/selectStyles"

export type YearMonthFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  notice?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  id?: string
  className?: string
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
  min?: string
  max?: string
  placeholder?: React.ReactNode
}

const rootControlCss = css`
  position: relative;
  width: 100%;
`

const triggerValueCss = css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
`

const triggerChevronCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin-left: var(--space-3);
  color: var(--field-chrome);
`

const popoverSizeCss = css`
  width: min(360px, calc(100vw - 32px));
  min-width: min(320px, calc(100vw - 32px));
  padding: var(--space-3);
`

/** Renders a click-only month picker field that stores values as `yyyy-MM`. */
export function YearMonthField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: YearMonthFieldProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    description,
    errorMessage,
    notice,
    fieldSize = "md",
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    id,
    className,
    min,
    max,
    placeholder,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const value = typeof field.value === "string" ? field.value : ""
  const selectedValue = parseYearMonth(value)
  const minValue = parseYearMonth(min)
  const maxValue = parseYearMonth(max)

  const generatedId = useId()
  const labelId = useId()
  const valueId = useId()
  const triggerId = id ?? generatedId
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [hasFocusWithin, setHasFocusWithin] = useState(false)

  const state = useOverlayTriggerState({})
  const { triggerProps } = useOverlayTrigger({ type: "dialog" }, state, triggerRef)
  const { buttonProps } = useButton(
    {
      ...triggerProps,
      id: triggerId,
      isDisabled,
      onPress: () => {
        if (isReadOnly) {
          return
        }
        state.toggle()
      },
    },
    triggerRef,
  )

  const emitCompositeFocus = () => {
    if (hasFocusWithin) {
      return
    }
    setHasFocusWithin(true)
  }

  const emitCompositeBlur = (relatedTarget: EventTarget | null) => {
    const nextFocusedNode = relatedTarget as Node | null
    if (
      triggerRef.current?.contains(nextFocusedNode) ||
      popoverRef.current?.contains(nextFocusedNode)
    ) {
      return
    }
    if (!hasFocusWithin) {
      return
    }
    setHasFocusWithin(false)
    field.onBlur()
  }

  const mergedButtonProps = mergeProps(buttonProps, {
    onFocus: () => emitCompositeFocus(),
    onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
      emitCompositeBlur(event.relatedTarget)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape" && state.isOpen) {
        event.preventDefault()
        state.close()
        triggerRef.current?.focus()
      }
    },
  })

  const dateFormatter = useDateFormatter({ month: "long", year: "numeric", timeZone: "UTC" })
  const displayValue = selectedValue
    ? dateFormatter.format(new Date(Date.UTC(selectedValue.year, selectedValue.month - 1, 1)))
    : null
  const isPlaceholder = displayValue === null
  const isFloated = state.isOpen || selectedValue !== null || hasFocusWithin

  return (
    <FieldShell
      {...(className !== undefined ? { className } : {})}
      controlClassName={rootControlCss}
      controlProps={{
        "data-field-control": "true",
        "data-focused": hasFocusWithin || state.isOpen ? "true" : "false",
        "data-floated": isFloated ? "true" : "false",
        "data-invalid": isInvalid ? "true" : "false",
        "data-placeholder": isPlaceholder ? "true" : "false",
      }}
      label={label}
      labelProps={{ id: labelId, className: resolveSelectLabelCss(fieldSize) }}
      description={description}
      errorMessage={resolvedError}
      notice={notice}
      isDisabled={isDisabled}
      isRequired={isRequired}
      layout="floating"
      fieldSize={fieldSize}
      isFloatingRaised={isFloated}
      isFloatingFocused={hasFocusWithin || state.isOpen}
      isInvalid={isInvalid}
    >
      <button
        {...mergedButtonProps}
        ref={triggerRef}
        className={resolveSelectTriggerCss(fieldSize)}
        type="button"
        aria-labelledby={`${labelId} ${valueId}`}
      >
        <span
          id={valueId}
          data-select-placeholder={isPlaceholder ? "true" : undefined}
          className={cx(
            triggerValueCss,
            isPlaceholder ? selectTriggerValuePlaceholderCss : undefined,
          )}
        >
          {displayValue ?? placeholder ?? null}
        </span>
        <span className={triggerChevronCss} aria-hidden="true">
          <span className={comboChevronCss} />
        </span>
      </button>
      <input ref={field.ref} type="hidden" name={field.name} value={value} readOnly />
      {state.isOpen ? (
        <Popover
          className={popoverSizeCss}
          popoverRef={popoverRef}
          state={state}
          triggerRef={triggerRef}
          placement="bottom"
          surfaceProps={{
            onFocus: () => emitCompositeFocus(),
            onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
              emitCompositeBlur(event.relatedTarget)
            },
          }}
        >
          <YearMonthPicker
            selectedYear={selectedValue?.year ?? null}
            selectedMonth={selectedValue?.month ?? null}
            {...(minValue?.year !== undefined ? { minYear: minValue.year } : {})}
            {...(minValue?.month !== undefined ? { minMonth: minValue.month } : {})}
            {...(maxValue?.year !== undefined ? { maxYear: maxValue.year } : {})}
            {...(maxValue?.month !== undefined ? { maxMonth: maxValue.month } : {})}
            isDisabled={isDisabled}
            isReadOnly={isReadOnly}
            onSelect={(year, month) => {
              field.onChange(serializeYearMonth(year, month))
              state.close()
              triggerRef.current?.focus()
            }}
          />
        </Popover>
      ) : null}
    </FieldShell>
  )
}
