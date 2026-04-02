"use client"

import { css, cx } from "@emotion/css"
import { Item } from "@react-stately/collections"
import { useComboBoxState } from "@react-stately/combobox"
import React, { useMemo, useRef, useState } from "react"
import { mergeProps, useButton, useComboBox, useFilter, useObjectRef } from "react-aria"
import { useTranslation } from "react-i18next"

import { normalizeComboBoxItems, resolveComboBoxHasValue } from "../lib/utils/combobox"
import type { ComboBoxItemAccessors } from "../lib/utils/combobox"
import { resolveFieldState, toInputValue } from "../lib/utils/field"

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
type ComboBoxKey = string | number

export type ComboBoxProps<T> = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "children" | "size"
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  items: Iterable<T>
  children?: ComboBoxRender<T>
  getItemKey: (item: T) => ComboBoxKey
  getItemTextValue: (item: T) => string
  getItemDisabled?: (item: T) => boolean
  inputValue?: string
  defaultInputValue?: string
  onInputChange?: (value: string) => void
  selectedKey?: ComboBoxKey | null
  defaultSelectedKey?: ComboBoxKey | null
  onSelectionChange?: (key: ComboBoxKey | null) => void
  allowsCustomValue?: boolean
  emptyState?: React.ReactNode
}

// eslint-disable-next-line i18next/no-literal-string
const filterSensitivityBase = "base" as const

export const ComboBox = React.forwardRef(function ComboBoxInner<T>(
  props: ComboBoxProps<T>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const {
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
    inputValue,
    defaultInputValue,
    onInputChange,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    allowsCustomValue = false,
    emptyState,
    className,
    value,
    defaultValue,
    disabled,
    readOnly,
    required,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    placeholder,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rest
  } = props

  const { t } = useTranslation("shared-module")
  const toggleOptionsLabel = t("comboBox.toggleOptions")

  const inputRef = useObjectRef(forwardedRef)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listBoxRef = useRef<HTMLUListElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const generatedInputId = React.useId()
  const inputId = id ?? generatedInputId
  const accessors = useMemo<ComboBoxItemAccessors<T>>(
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
  const resolvedState = resolveFieldState({
    disabled,
    readOnly,
    required,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    ariaInvalid,
    errorMessage,
  })
  const resolvedInputValue = inputValue ?? (value !== undefined ? toInputValue(value) : undefined)
  const resolvedDefaultInputValue =
    defaultInputValue ?? (defaultValue !== undefined ? toInputValue(defaultValue) : undefined)

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
    defaultSelectedKey: defaultSelectedKey ?? undefined,
    onSelectionChange,
    inputValue: resolvedInputValue,
    defaultInputValue: resolvedDefaultInputValue,
    onInputChange,
    allowsCustomValue,
    isDisabled: resolvedState.isDisabled,
    isReadOnly: resolvedState.isReadOnly,
    isRequired: resolvedState.isRequired,
    isInvalid: resolvedState.isInvalid,
    label,
    description,
    errorMessage,
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
      ...rest,
      id: inputId,
      items: normalizedItems,
      disabledKeys,
      inputRef,
      buttonRef,
      listBoxRef,
      popoverRef,
      selectedKey,
      defaultSelectedKey: defaultSelectedKey ?? undefined,
      inputValue: resolvedInputValue,
      defaultInputValue: resolvedDefaultInputValue,
      onInputChange,
      allowsCustomValue,
      isDisabled: resolvedState.isDisabled,
      isReadOnly: resolvedState.isReadOnly,
      isRequired: resolvedState.isRequired,
      isInvalid: resolvedState.isInvalid,
      label,
      description,
      errorMessage,
      placeholder: placeholder ?? " ",
      "aria-describedby": ariaDescribedBy,
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
    onChange,
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      inputProps.onFocus?.(event)
      onFocus?.(event)
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      inputProps.onBlur?.(event)
      onBlur?.(event)
    },
    onKeyDown,
    onKeyUp,
  })
  const resolvedErrorMessage =
    errorMessage ??
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
        data-disabled={resolvedState.isDisabled ? "true" : "false"}
        data-invalid={hookIsInvalid ? "true" : "false"}
        data-readonly={resolvedState.isReadOnly ? "true" : "false"}
        data-focused={isFocused ? "true" : "false"}
        data-floated={isFloated ? "true" : "false"}
        data-filled={hasValue ? "true" : "false"}
      >
        <input
          {...mergedInputProps}
          ref={inputRef}
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

      {resolvedErrorMessage ? (
        <p {...errorMessageProps} role="alert" className={resolveMessageCss(fieldSize, true)}>
          {resolvedErrorMessage}
        </p>
      ) : description ? (
        <p {...descriptionProps} className={resolveMessageCss(fieldSize, false)}>
          {description}
        </p>
      ) : null}
    </div>
  )
}) as <T>(
  props: ComboBoxProps<T> & { ref?: React.ForwardedRef<HTMLInputElement> },
) => React.ReactElement
