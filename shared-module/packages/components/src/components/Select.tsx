"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react"

import { useControllableState } from "../lib/utils/controllable"
import { resolveFieldDescribedBy, resolveFieldState, toInputValue } from "../lib/utils/field"

import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveMessageCss,
  resolveSelectLabelCss,
  resolveSelectTriggerCss,
} from "./primitives/fieldStyles"
import { ListBox, type ListBoxItem } from "./primitives/listBox"
import { Popover } from "./primitives/popover"
import { comboChevronCss } from "./primitives/selectStyles"

type SelectOption = ListBoxItem<string> & {
  value: string
}

type ChildrenProp = {
  children?: React.ReactNode
}

type OptionElement = React.ReactElement<React.ComponentPropsWithoutRef<"option">, "option">
type OptGroupElement = React.ReactElement<React.ComponentPropsWithoutRef<"optgroup">, "optgroup">

function isElementWithChildren(node: React.ReactNode): node is React.ReactElement<ChildrenProp> {
  return React.isValidElement<ChildrenProp>(node)
}

function isOptionElement(node: React.ReactNode): node is OptionElement {
  return (
    React.isValidElement<React.ComponentPropsWithoutRef<"option">>(node) && node.type === "option"
  )
}

function isOptGroupElement(node: React.ReactNode): node is OptGroupElement {
  return (
    React.isValidElement<React.ComponentPropsWithoutRef<"optgroup">>(node) &&
    node.type === "optgroup"
  )
}

export type SelectProps = React.ComponentPropsWithoutRef<"select"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isRequired?: boolean
  isInvalid?: boolean
}

const selectRootCss = css`
  position: relative;
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

const hiddenSelectCss = css`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
`

function getNodeTextValue(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return ""
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(getNodeTextValue).join("")
  }

  if (isElementWithChildren(node)) {
    return getNodeTextValue(node.props.children)
  }

  return ""
}

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = []

  function walk(node: React.ReactNode) {
    React.Children.forEach(node, (child, index) => {
      if (!isElementWithChildren(child)) {
        return
      }

      if (child.type === React.Fragment) {
        walk(child.props.children)
        return
      }

      if (isOptionElement(child)) {
        const textValue = getNodeTextValue(child.props.children)
        const value = toInputValue(child.props.value ?? textValue)

        options.push({
          item: value,
          // eslint-disable-next-line i18next/no-literal-string
          key: value || `option-${options.length}-${index}`,
          value,
          rendered: child.props.children,
          textValue,
          isDisabled: Boolean(child.props.disabled),
        })
        return
      }

      if (isOptGroupElement(child)) {
        walk(child.props.children)
      }
    })
  }

  walk(children)
  return options
}

function getNextEnabledOption(
  items: SelectOption[],
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

function buildSelectChangeEvent(target: HTMLSelectElement): React.ChangeEvent<HTMLSelectElement> {
  return {
    target,
    currentTarget: target,
  } as React.ChangeEvent<HTMLSelectElement>
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  function Select(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      fieldSize = "md",
      isDisabled,
      isRequired,
      isInvalid,
      className,
      disabled,
      required,
      children,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      name,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const generatedInputId = useId()
    const triggerId = id ?? generatedInputId
    const descriptionId = useId()
    const errorMessageId = useId()
    // eslint-disable-next-line i18next/no-literal-string
    const listBoxId = `${triggerId}-listbox`
    const options = useMemo(() => collectOptions(children), [children])
    const initialValue =
      value !== undefined
        ? toInputValue(value)
        : defaultValue !== undefined
          ? toInputValue(defaultValue)
          : (options[0]?.value ?? "")

    const state = resolveFieldState({
      disabled,
      required,
      isDisabled,
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

    const hiddenSelectRef = useRef<HTMLSelectElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    useImperativeHandle(forwardedRef, () => wrapperRef.current as HTMLDivElement)

    const [selectedValue, setSelectedValue] = useControllableState<string>({
      value: value !== undefined ? toInputValue(value) : undefined,
      defaultValue: initialValue,
    })
    const [isOpen, setIsOpen] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [highlightedKey, setHighlightedKey] = useState<React.Key | null>(null)

    const selectedOption = options.find((item) => item.value === selectedValue) ?? null
    const enabledOptions = options.filter((item) => !item.isDisabled)
    const hasSelection = selectedValue.length > 0
    const isFloated = isFocused || hasSelection

    useEffect(() => {
      if (!hiddenSelectRef.current) {
        return
      }

      hiddenSelectRef.current.value = selectedValue
    }, [selectedValue])

    useEffect(() => {
      if (!isOpen) {
        return
      }

      function handlePointerDown(event: MouseEvent) {
        if (!wrapperRef.current?.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      document.addEventListener("mousedown", handlePointerDown)
      return () => {
        document.removeEventListener("mousedown", handlePointerDown)
      }
    }, [isOpen])

    function emitChange(nextValue: string) {
      if (!hiddenSelectRef.current || !onChange) {
        return
      }

      hiddenSelectRef.current.value = nextValue
      onChange(buildSelectChangeEvent(hiddenSelectRef.current))
    }

    function openMenu() {
      if (state.isDisabled) {
        return
      }

      setHighlightedKey(selectedOption?.key ?? enabledOptions[0]?.key ?? null)
      setIsOpen(true)
    }

    function closeMenu() {
      setIsOpen(false)
    }

    function selectOption(option: ListBoxItem<string>) {
      const nextValue = option.item

      if (state.isDisabled || option.isDisabled || nextValue === selectedValue) {
        closeMenu()
        buttonRef.current?.focus()
        return
      }

      setSelectedValue(nextValue)
      emitChange(nextValue)
      setHighlightedKey(option.key)
      closeMenu()
      buttonRef.current?.focus()
    }

    function moveHighlight(direction: 1 | -1) {
      const nextOption = getNextEnabledOption(options, direction, highlightedKey)
      setHighlightedKey(nextOption?.key ?? null)
    }

    return (
      <div ref={wrapperRef} className={cx(fieldRootCss, className)}>
        <div
          className={cx(fieldControlCss, selectRootCss)}
          data-focused={isFocused ? "true" : "false"}
          data-invalid={state.isInvalid ? "true" : "false"}
          data-floated={isFloated ? "true" : "false"}
        >
          <button
            id={triggerId}
            ref={buttonRef}
            className={resolveSelectTriggerCss(fieldSize)}
            type="button"
            disabled={state.isDisabled}
            aria-describedby={describedBy}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={isOpen ? listBoxId : undefined}
            onFocus={(event) => {
              setIsFocused(true)
              onFocus?.(event as unknown as React.FocusEvent<HTMLSelectElement>)
            }}
            onBlur={(event) => {
              setIsFocused(false)
              if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
                closeMenu()
              }
              onBlur?.(event as unknown as React.FocusEvent<HTMLSelectElement>)
            }}
            onClick={(event) => {
              // Ignore keyboard-generated click events; keyboard interaction is
              // handled explicitly in onKeyDown so the menu doesn't double-toggle.
              if (event.detail === 0) {
                return
              }

              if (isOpen) {
                closeMenu()
              } else {
                openMenu()
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                if (!isOpen) {
                  openMenu()
                } else {
                  moveHighlight(1)
                }
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                if (!isOpen) {
                  openMenu()
                } else {
                  moveHighlight(-1)
                }
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                if (!isOpen) {
                  openMenu()
                } else if (highlightedKey != null) {
                  const option = options.find((item) => item.key === highlightedKey)
                  if (option) {
                    selectOption(option)
                  }
                }
              } else if (event.key === "Escape") {
                closeMenu()
              } else if (event.key === "Home" && isOpen) {
                event.preventDefault()
                setHighlightedKey(enabledOptions[0]?.key ?? null)
              } else if (event.key === "End" && isOpen) {
                event.preventDefault()
                setHighlightedKey(enabledOptions[enabledOptions.length - 1]?.key ?? null)
              } else if (event.key === "Tab") {
                closeMenu()
              }

              onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLSelectElement>)
            }}
          >
            <span className={triggerValueCss}>
              {hasSelection ? selectedOption?.rendered : null}
            </span>
            <span className={triggerChevronCss} aria-hidden="true">
              <span className={comboChevronCss} />
            </span>
          </button>

          <label htmlFor={triggerId} className={resolveSelectLabelCss(fieldSize)}>
            {label}
          </label>

          <select
            {...rest}
            ref={hiddenSelectRef}
            className={hiddenSelectCss}
            tabIndex={-1}
            aria-hidden="true"
            name={name}
            value={selectedValue}
            disabled={state.isDisabled}
            required={state.isRequired}
            onChange={() => {}}
          >
            {children}
          </select>

          {isOpen ? (
            <Popover>
              <div id={listBoxId}>
                <ListBox
                  items={options}
                  idBase={triggerId}
                  highlightedKey={highlightedKey}
                  selectedKey={selectedOption?.key ?? null}
                  onAction={selectOption}
                />
              </div>
            </Popover>
          ) : null}
        </div>

        {errorMessage ? (
          <p id={errorMessageId} role="alert" className={resolveMessageCss(fieldSize, true)}>
            {errorMessage}
          </p>
        ) : description ? (
          <p id={descriptionId} className={resolveMessageCss(fieldSize, false)}>
            {description}
          </p>
        ) : null}
      </div>
    )
  },
)
