"use client"

import { css, cx } from "@emotion/css"
import { Item } from "@react-stately/collections"
import { useComboBoxState } from "@react-stately/combobox"
import type { Key } from "@react-types/shared"
import React, { useMemo, useRef, useState } from "react"
import { mergeProps, useButton, useComboBox, useFilter, useObjectRef } from "react-aria"
import { useTranslation } from "react-i18next"

import { resolveFieldState, toInputValue } from "../lib/utils/field"

import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveComboBoxInputCss,
  resolveControlSurfaceCss,
  resolveFieldLabelCss,
  resolveMessageCss,
} from "./primitives/fieldStyles"
import { ListBox } from "./primitives/listBox"
import { Popover } from "./primitives/popover"
import { comboChevronCss, comboTriggerButtonCss } from "./primitives/selectStyles"

const comboBoxRootCss = css`
  position: relative;
`

type ComboBoxRender<T> = (item: T) => React.ReactNode

type ComboBoxCollectionItem<T> = {
  item: T
  key: Key
  rendered: React.ReactNode
  textValue: string
  isDisabled: boolean
}

export type ComboBoxProps<T> = Omit<React.ComponentPropsWithoutRef<"input">, "children"> & {
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
  selectedKey?: Key | null
  defaultSelectedKey?: Key | null
  onSelectionChange?: (key: Key | null) => void
  allowsCustomValue?: boolean
  emptyState?: React.ReactNode
}

// eslint-disable-next-line i18next/no-literal-string
const filterSensitivityBase = "base" as const

function getItemKey<T>(item: T, index: number): Key {
  if (item == null) {
    return index
  }

  if (typeof item === "string" || typeof item === "number") {
    return item
  }

  if (typeof item === "object") {
    if ("key" in item && item.key != null) {
      return item.key as Key
    }

    if ("id" in item && item.id != null) {
      return item.id as Key
    }

    if ("value" in item && item.value != null) {
      return item.value as Key
    }
  }

  return index
}

function getItemTextValue<T>(item: T): string {
  if (item == null) {
    return ""
  }

  if (typeof item === "string" || typeof item === "number") {
    return String(item)
  }

  if (typeof item === "object") {
    if ("textValue" in item && typeof item.textValue === "string") {
      return item.textValue
    }

    if ("label" in item && typeof item.label === "string") {
      return item.label
    }

    if ("name" in item && typeof item.name === "string") {
      return item.name
    }

    if ("title" in item && typeof item.title === "string") {
      return item.title
    }

    if ("value" in item && item.value != null) {
      return String(item.value)
    }
  }

  return String(item)
}

function normalizeItems<T>(items: Iterable<T>, renderItem?: ComboBoxRender<T>) {
  return Array.from(items).map<ComboBoxCollectionItem<T>>((item, index) => {
    const textValue = getItemTextValue(item)

    return {
      item,
      key: getItemKey(item, index),
      rendered: renderItem ? renderItem(item) : textValue,
      textValue,
      isDisabled:
        typeof item === "object" && item != null && "disabled" in item
          ? Boolean(item.disabled)
          : false,
    }
  })
}

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

  const { t } = useTranslation()
  const toggleOptionsLabel = t("comboBox.toggleOptions")

  const inputRef = useObjectRef(forwardedRef)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listBoxRef = useRef<HTMLUListElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const generatedInputId = React.useId()
  const inputId = id ?? generatedInputId
  const normalizedItems = useMemo(() => normalizeItems(items, children), [children, items])
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

  const state = useComboBoxState<ComboBoxCollectionItem<T>>({
    items: normalizedItems,
    children: (item: ComboBoxCollectionItem<T>) => (
      <Item key={item.key} textValue={item.textValue}>
        {item.rendered}
      </Item>
    ),
    disabledKeys,
    defaultFilter: contains,
    selectedKey,
    defaultSelectedKey: defaultSelectedKey ?? undefined,
    onSelectionChange,
    inputValue: value !== undefined ? toInputValue(value) : undefined,
    defaultInputValue: defaultValue !== undefined ? toInputValue(defaultValue) : undefined,
    allowsCustomValue,
    isDisabled: resolvedState.isDisabled,
    isReadOnly: resolvedState.isReadOnly,
    isRequired: resolvedState.isRequired,
    isInvalid: resolvedState.isInvalid,
    label,
    description,
    errorMessage,
    placeholder: placeholder ?? " ",
    onBlur: onBlur as React.FocusEventHandler<HTMLInputElement> | undefined,
    onFocus: onFocus as React.FocusEventHandler<HTMLInputElement> | undefined,
    onKeyDown: onKeyDown as React.KeyboardEventHandler<HTMLInputElement> | undefined,
    onKeyUp: onKeyUp as React.KeyboardEventHandler<HTMLInputElement> | undefined,
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
      inputValue: value !== undefined ? toInputValue(value) : undefined,
      defaultInputValue: defaultValue !== undefined ? toInputValue(defaultValue) : undefined,
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
      onBlur: onBlur as React.FocusEventHandler<HTMLInputElement> | undefined,
      onFocus: onFocus as React.FocusEventHandler<HTMLInputElement> | undefined,
      onKeyDown: onKeyDown as React.KeyboardEventHandler<HTMLInputElement> | undefined,
      onKeyUp: onKeyUp as React.KeyboardEventHandler<HTMLInputElement> | undefined,
    },
    state,
  )

  const { buttonProps } = useButton(triggerProps, buttonRef)
  const [isFocused, setIsFocused] = useState(false)
  const inputValueFromState = state.inputValue ?? ""
  const hasValue =
    state.selectedItem != null ||
    (typeof inputValueFromState === "string" && inputValueFromState.trim().length > 0)
  const isFloated = isFocused || hasValue

  const mergedInputProps = mergeProps(inputProps, {
    onChange,
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      inputProps.onFocus?.(event)
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      inputProps.onBlur?.(event)
    },
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
