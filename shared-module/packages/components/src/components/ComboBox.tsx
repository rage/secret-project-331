"use client"

import { css, cx } from "@emotion/css"
import { Item } from "@react-stately/collections"
import { useComboBoxState } from "@react-stately/combobox"
import React, { useMemo, useRef, useState } from "react"
import { mergeProps, useButton, useComboBox, useFilter } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { normalizeComboBoxItems, resolveComboBoxHasValue } from "../lib/utils/combobox"
import type { ComboBoxItemAccessors } from "../lib/utils/combobox"
import { composeRefs } from "../lib/utils/compositeField"

import { ListBox } from "./primitives/ListBox"
import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveComboBoxInputCss,
  resolveControlSurfaceCss,
  resolveFieldLabelCss,
  resolveMessageCss,
} from "./primitives/fieldStyles"
import { Popover } from "./primitives/popover"
import { comboChevronCss, comboTriggerButtonCss } from "./primitives/selectStyles"

const comboBoxRootCss = css`
  position: relative;
`

type ComboBoxRender<T> = (item: T) => React.ReactNode
export type ComboBoxKey = string | number

/**
 * Filterable combobox with optional custom text (`allowsCustomValue`).
 * Uses react-hook-form; pass `name` and `control`. Field value is the selected item key (`string` | `number` | `null`).
 * Optional `inputValue` / `onInputChange` control the filter text separately from the field value; use them when
 * `allowsCustomValue` is true or the form must track raw input (default text state stays inside the combobox).
 *
 * @example
 * <ComboBox name="lang" control={control} label="Language" items={langs} getItemKey={(x) => x.id} getItemTextValue={(x) => x.name} />
 */
export type ComboBoxProps<
  TItem,
  TField extends FieldValues = FieldValues,
  N extends Path<TField> = Path<TField>,
> = RhfFieldProps<TField, N> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  items: Iterable<TItem>
  children?: ComboBoxRender<TItem>
  getItemKey: (item: TItem) => ComboBoxKey
  getItemTextValue: (item: TItem) => string
  getItemDisabled?: (item: TItem) => boolean
  inputValue?: string
  onInputChange?: (value: string) => void
  allowsCustomValue?: boolean
  emptyState?: React.ReactNode
  id?: string
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>
  placeholder?: string
  "aria-label"?: string
  className?: string
}

// eslint-disable-next-line i18next/no-literal-string
const filterSensitivityBase = "base" as const

export function ComboBox<TItem, TField extends FieldValues, N extends Path<TField> = Path<TField>>(
  props: ComboBoxProps<TItem, TField, N>,
) {
  const {
    name,
    control,
    rules,
    id,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    items,
    children,
    getItemKey,
    getItemTextValue,
    getItemDisabled,
    inputValue: inputValueProp,
    onInputChange: onInputChangeProp,
    allowsCustomValue = false,
    emptyState,
    className,
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    placeholder,
    "aria-label": ariaLabel,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })

  const { t } = useTranslation("shared-module")
  const toggleOptionsLabel = t("comboBox.toggleOptions")

  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listBoxRef = useRef<HTMLUListElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const generatedInputId = React.useId()
  const inputId = id ?? generatedInputId
  const accessors = useMemo<ComboBoxItemAccessors<TItem>>(
    () => ({
      getItemDisabled,
      getItemKey,
      getItemTextValue,
      renderItem: children,
    }),
    [children, getItemDisabled, getItemKey, getItemTextValue],
  )
  const normalizedItems = useMemo(
    () => normalizeComboBoxItems(items, accessors),
    [accessors, items],
  )
  const disabledKeys = useMemo(
    () => normalizedItems.filter((item) => item.isDisabled).map((item) => item.key),
    [normalizedItems],
  )
  const { contains } = useFilter({ sensitivity: filterSensitivityBase })

  const selectedKey =
    field.value === null || field.value === undefined ? null : (field.value as ComboBoxKey)

  const state = useComboBoxState({
    items: normalizedItems,
    children: (item) => (
      <Item key={item.key} textValue={item.textValue}>
        {item.rendered}
      </Item>
    ),
    disabledKeys,
    defaultFilter: contains,
    selectedKey,
    onSelectionChange: (key) => {
      field.onChange(key)
    },
    inputValue: inputValueProp,
    onInputChange: onInputChangeProp,
    allowsCustomValue,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    label,
    description,
    errorMessage: resolvedError,
    placeholder: placeholder ?? " ",
  })

  const {
    buttonProps: triggerProps,
    inputProps,
    listBoxProps,
    labelProps,
    descriptionProps,
    errorMessageProps,
    isInvalid: hookIsInvalid,
    validationErrors,
  } = useComboBox(
    {
      id: inputId,
      items: normalizedItems,
      disabledKeys,
      inputRef,
      buttonRef,
      listBoxRef,
      popoverRef,
      selectedKey,
      inputValue: inputValueProp,
      onInputChange: onInputChangeProp,
      allowsCustomValue,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      label,
      description,
      errorMessage: resolvedError,
      placeholder: placeholder ?? " ",
      "aria-describedby": undefined,
      "aria-label": ariaLabel,
      name: field.name,
    },
    state,
  )

  const { buttonProps } = useButton(triggerProps, buttonRef)
  const [isFocused, setIsFocused] = useState(false)
  const hasValue = resolveComboBoxHasValue({
    inputValue: state.inputValue,
    selectedItem: state.selectedItem,
  })
  const isFloated = isFocused || hasValue

  const mergedInputProps = mergeProps(inputProps, {
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      inputProps.onFocus?.(event)
      onFocus?.(event)
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      inputProps.onBlur?.(event)
      onBlur?.(event)
      field.onBlur()
    },
    onKeyDown,
    onKeyUp,
  })

  const resolvedRenderedError =
    resolvedError ??
    (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)

  return (
    <div className={cx(fieldRootCss, className)}>
      <div
        className={cx(
          fieldControlCss,
          resolveControlSurfaceCss(fieldSize, isFloated),
          comboBoxRootCss,
        )}
        data-field-control="true"
        data-disabled={isDisabled ? "true" : "false"}
        data-invalid={hookIsInvalid ? "true" : "false"}
        data-readonly={isReadOnly ? "true" : "false"}
        data-focused={isFocused ? "true" : "false"}
        data-floated={isFloated ? "true" : "false"}
        data-filled={hasValue ? "true" : "false"}
      >
        <input
          {...mergedInputProps}
          ref={composeRefs(inputRef, field.ref)}
          className={resolveComboBoxInputCss(fieldSize)}
        />
        <label {...labelProps} className={resolveFieldLabelCss(fieldSize)}>
          {label}
        </label>
        <button
          {...buttonProps}
          ref={buttonRef}
          className={comboTriggerButtonCss}
          aria-label={toggleOptionsLabel}
          type="button"
        >
          <span className={comboChevronCss} aria-hidden="true" />
        </button>

        {state.isOpen ? (
          <Popover isNonModal popoverRef={popoverRef} state={state} triggerRef={inputRef}>
            <ListBox
              {...listBoxProps}
              emptyState={emptyState}
              listBoxRef={listBoxRef}
              state={state}
            />
          </Popover>
        ) : null}
      </div>

      {resolvedRenderedError ? (
        <p {...errorMessageProps} role="alert" className={resolveMessageCss(fieldSize, true)}>
          {resolvedRenderedError}
        </p>
      ) : description ? (
        <p {...descriptionProps} className={resolveMessageCss(fieldSize, false)}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
