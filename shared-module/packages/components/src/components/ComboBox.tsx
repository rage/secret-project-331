"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react"

import { useControllableState } from "../lib/utils/controllable"
import { resolveFieldDescribedBy, resolveFieldState, toInputValue } from "../lib/utils/field"

import { FieldShell } from "./primitives/FieldShell"
import { type FieldSize, inputResetCss, resolveControlSurfaceCss } from "./primitives/fieldStyles"
import { ListBox, type ListBoxItem } from "./primitives/listBox"
import { Popover } from "./primitives/popover"
import { comboChevronCss, comboTriggerButtonCss } from "./primitives/selectStyles"

const comboBoxRootCss = css`
  position: relative;
`

type ComboBoxRender<T> = (item: T) => React.ReactNode

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
  selectedKey?: React.Key | null
  defaultSelectedKey?: React.Key | null
  onSelectionChange?: (key: React.Key | null) => void
  allowsCustomValue?: boolean
  emptyState?: React.ReactNode
}

// eslint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// eslint-disable-next-line i18next/no-literal-string
const toggleOptionsLabel = "Toggle options"
function getItemKey<T>(item: T, index: number): React.Key {
  if (item == null) {
    return index
  }

  if (typeof item === "string" || typeof item === "number") {
    return item
  }

  if (typeof item === "object") {
    if ("key" in item && item.key != null) {
      return item.key as React.Key
    }

    if ("id" in item && item.id != null) {
      return item.id as React.Key
    }

    if ("value" in item && item.value != null) {
      return item.value as React.Key
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

function normalizeItems<T>(items: Iterable<T>, renderItem?: ComboBoxRender<T>): ListBoxItem<T>[] {
  return Array.from(items).map((item, index) => {
    const textValue = getItemTextValue(item)

    return {
      item,
      key: getItemKey(item, index),
      textValue,
      rendered: renderItem ? renderItem(item) : textValue,
      isDisabled:
        typeof item === "object" && item != null && "disabled" in item
          ? Boolean(item.disabled)
          : false,
    }
  })
}

function getNextEnabledItem<T>(
  items: ListBoxItem<T>[],
  direction: 1 | -1,
  highlightedKey: React.Key | null,
) {
  const enabledItems = items.filter((item) => !item.isDisabled)

  if (enabledItems.length === 0) {
    return null
  }

  const currentIndex = enabledItems.findIndex((item) => item.key === highlightedKey)
  const startIndex = currentIndex === -1 ? (direction === 1 ? -1 : 0) : currentIndex
  const nextIndex = (startIndex + direction + enabledItems.length) % enabledItems.length

  return enabledItems[nextIndex] ?? null
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
    placeholder,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rest
  } = props

  const generatedInputId = useId()
  const inputId = id ?? generatedInputId
  const descriptionId = useId()
  const errorMessageId = useId()
  // eslint-disable-next-line i18next/no-literal-string
  const listBoxId = `${inputId}-listbox`
  const state = resolveFieldState({
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

  const describedBy = resolveFieldDescribedBy({
    ariaDescribedBy,
    descriptionId,
    errorMessageId,
    hasDescription: Boolean(description),
    hasErrorMessage: Boolean(errorMessage),
  })

  const normalizedItems = useMemo(() => normalizeItems(items, children), [children, items])
  const selectedItem = normalizedItems.find(
    (item) => item.key === (selectedKey ?? defaultSelectedKey),
  )
  const initialInputValue =
    value !== undefined
      ? toInputValue(value)
      : defaultValue !== undefined
        ? toInputValue(defaultValue)
        : (selectedItem?.textValue ?? "")

  const [internalSelectedKey, setInternalSelectedKey] = useControllableState<React.Key | null>({
    value: selectedKey,
    defaultValue: defaultSelectedKey ?? null,
    onChange: onSelectionChange,
  })
  const [inputValue, setInputValue] = useControllableState<string>({
    value: value !== undefined ? toInputValue(value) : undefined,
    defaultValue: initialInputValue,
  })
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [highlightedKey, setHighlightedKey] = useState<React.Key | null>(
    defaultSelectedKey ?? normalizedItems[0]?.key ?? null,
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

  const filteredItems = useMemo(() => {
    const query = inputValue.trim().toLocaleLowerCase()

    if (query.length === 0) {
      return normalizedItems
    }

    return normalizedItems.filter((item) => item.textValue.toLocaleLowerCase().includes(query))
  }, [inputValue, normalizedItems])

  useEffect(() => {
    if (value === undefined) {
      const nextSelectedItem = normalizedItems.find((item) => item.key === internalSelectedKey)
      if (nextSelectedItem) {
        setInputValue(nextSelectedItem.textValue)
      } else if (!allowsCustomValue) {
        setInputValue("")
      }
    }
  }, [allowsCustomValue, internalSelectedKey, normalizedItems, setInputValue, value])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)

        if (!allowsCustomValue) {
          const committedItem = normalizedItems.find((item) => item.key === internalSelectedKey)
          setInputValue(committedItem?.textValue ?? "")
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [allowsCustomValue, internalSelectedKey, isOpen, normalizedItems, setInputValue])

  useEffect(() => {
    const highlightedItem = filteredItems.find((item) => item.key === highlightedKey)

    if (!highlightedItem || highlightedItem.isDisabled) {
      setHighlightedKey(filteredItems.find((item) => !item.isDisabled)?.key ?? null)
    }
  }, [filteredItems, highlightedKey])

  function selectItem(item: ListBoxItem<T>) {
    if (state.isReadOnly || item.isDisabled) {
      return
    }

    setInternalSelectedKey(item.key)
    setInputValue(item.textValue)
    setHighlightedKey(item.key)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function restoreCommittedInputValue() {
    const committedItem = normalizedItems.find((item) => item.key === internalSelectedKey)
    setInputValue(committedItem?.textValue ?? "")
  }

  function moveHighlight(direction: 1 | -1) {
    const nextItem = getNextEnabledItem(filteredItems, direction, highlightedKey)

    if (!nextItem) {
      setHighlightedKey(null)
      return
    }

    setHighlightedKey(nextItem.key)
  }

  return (
    <FieldShell
      className={cx(comboBoxRootCss, className)}
      label={label}
      inputId={inputId}
      description={description}
      descriptionId={description ? descriptionId : undefined}
      errorMessage={errorMessage}
      errorMessageId={errorMessage ? errorMessageId : undefined}
      isDisabled={state.isDisabled}
      isRequired={state.isRequired}
      layout={floatingLayout}
      isFloatingRaised={isFocused || inputValue.length > 0}
    >
      <div ref={wrapperRef} className={comboBoxRootCss}>
        <div
          className={cx(resolveControlSurfaceCss(fieldSize, true))}
          data-disabled={state.isDisabled ? "true" : "false"}
        >
          <input
            {...rest}
            id={inputId}
            ref={inputRef}
            className={inputResetCss}
            role="combobox"
            type="text"
            autoComplete="off"
            value={inputValue}
            disabled={state.isDisabled}
            readOnly={state.isReadOnly}
            required={state.isRequired}
            aria-invalid={state.isInvalid ? "true" : undefined}
            aria-describedby={describedBy}
            aria-expanded={isOpen}
            aria-controls={listBoxId}
            aria-activedescendant={
              isOpen && highlightedKey != null
                ? `${inputId}-option-${String(highlightedKey)}`
                : undefined
            }
            aria-autocomplete="list"
            placeholder={placeholder ?? " "}
            onFocus={(event) => {
              setIsFocused(true)
              onFocus?.(event)
            }}
            onBlur={(event) => {
              setIsFocused(false)
              if (!allowsCustomValue) {
                restoreCommittedInputValue()
              }
              onBlur?.(event)
            }}
            onChange={(event) => {
              if (state.isReadOnly) {
                return
              }

              setInputValue(event.currentTarget.value)
              setIsOpen(true)
              onChange?.(event)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                if (!isOpen) {
                  setIsOpen(true)
                }
                moveHighlight(1)
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                if (!isOpen) {
                  setIsOpen(true)
                }
                moveHighlight(-1)
              } else if (event.key === "Enter" && isOpen && highlightedKey != null) {
                event.preventDefault()
                const item = filteredItems.find((entry) => entry.key === highlightedKey)
                if (item) {
                  selectItem(item)
                }
              } else if (event.key === "Escape") {
                setIsOpen(false)
              } else if (event.key === "Tab") {
                setIsOpen(false)
              }

              onKeyDown?.(event)
            }}
          />
          <button
            className={comboTriggerButtonCss}
            type="button"
            tabIndex={-1}
            aria-label={toggleOptionsLabel}
            disabled={state.isDisabled}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              setIsOpen((open) => !open)
              inputRef.current?.focus()
            }}
          >
            <span className={comboChevronCss} aria-hidden="true" />
          </button>
        </div>

        {isOpen ? (
          <Popover>
            <div id={listBoxId}>
              <ListBox
                items={filteredItems}
                idBase={inputId}
                emptyState={emptyState}
                highlightedKey={highlightedKey}
                selectedKey={internalSelectedKey}
                onAction={selectItem}
              />
            </div>
          </Popover>
        ) : null}
      </div>
    </FieldShell>
  )
}) as <T>(
  props: ComboBoxProps<T> & { ref?: React.ForwardedRef<HTMLInputElement> },
) => React.ReactElement
