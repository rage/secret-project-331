"use client"

import { css, cx } from "@emotion/css"
import { Item, Section } from "@react-stately/collections"
import { useSelectState } from "@react-stately/select"
import type { CollectionElement, ItemElement } from "@react-types/shared"
import React, { useId, useImperativeHandle, useMemo, useRef } from "react"
import { HiddenSelect, useButton, useSelect } from "react-aria"

import { resolveFieldState, toInputValue } from "../lib/utils/field"

import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveMessageCss,
  resolveSelectLabelCss,
  resolveSelectTriggerCss,
} from "./primitives/fieldStyles"
import { ListBox } from "./primitives/listBox"
import { Popover } from "./primitives/popover"
import { comboChevronCss } from "./primitives/selectStyles"

type SelectOptionRecord = {
  key: string
  value: string
  textValue: string
  rendered: React.ReactNode
  isDisabled: boolean
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

// eslint-disable-next-line i18next/no-literal-string
const optionKeyFallback = "option"
// eslint-disable-next-line i18next/no-literal-string
const eventTargetValueProperty = "value"

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

function buildSelectCollection(children: React.ReactNode) {
  const collectionChildren: CollectionElement<SelectOptionRecord>[] = []
  const disabledKeys: string[] = []
  const options: SelectOptionRecord[] = []
  const valueToKey = new Map<string, string>()
  const seenKeys = new Set<string>()
  let generatedIndex = 0

  function getOptionKey(value: string) {
    if (!seenKeys.has(value)) {
      seenKeys.add(value)
      return value
    }

    generatedIndex += 1
    const fallbackKey = `${value || optionKeyFallback}-${generatedIndex}`
    seenKeys.add(fallbackKey)
    return fallbackKey
  }

  function createOption(child: OptionElement) {
    const textValue = getNodeTextValue(child.props.children)
    const value = toInputValue(child.props.value ?? textValue)
    const key = getOptionKey(value)

    if (!valueToKey.has(value)) {
      valueToKey.set(value, key)
    }

    const option = {
      key,
      value,
      textValue,
      rendered: child.props.children,
      isDisabled: Boolean(child.props.disabled),
    }

    options.push(option)

    if (option.isDisabled) {
      disabledKeys.push(option.key)
    }

    return (
      <Item key={option.key} textValue={option.textValue} aria-label={child.props["aria-label"]}>
        {option.rendered}
      </Item>
    )
  }

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
        collectionChildren.push(createOption(child) as CollectionElement<SelectOptionRecord>)
        return
      }

      if (isOptGroupElement(child)) {
        const sectionChildren: ItemElement<SelectOptionRecord>[] = []

        React.Children.forEach(child.props.children, (optionChild) => {
          if (isOptionElement(optionChild)) {
            sectionChildren.push(createOption(optionChild) as ItemElement<SelectOptionRecord>)
          }
        })

        collectionChildren.push(
          (
            <Section
              key={`${child.props.label || "group"}-${index}`}
              aria-label={child.props.label}
              title={child.props.label}
            >
              {sectionChildren}
            </Section>
          ) as CollectionElement<SelectOptionRecord>,
        )
      }
    })
  }

  walk(children)

  return {
    collectionChildren,
    disabledKeys,
    options,
    valueToKey,
  }
}

function buildSelectChangeEvent(
  name: string | undefined,
  nextValue: string,
): React.ChangeEvent<HTMLSelectElement> {
  const eventTarget = document.createElement("select")

  if (name) {
    eventTarget.name = name
  }

  Object.defineProperty(eventTarget, eventTargetValueProperty, {
    configurable: true,
    enumerable: true,
    value: nextValue,
  })

  return {
    currentTarget: eventTarget,
    target: eventTarget,
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
      onKeyUp,
      name,
      autoComplete,
      form,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const generatedInputId = useId()
    const triggerId = id ?? generatedInputId
    const buttonRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(forwardedRef, () => wrapperRef.current as HTMLDivElement)

    const collection = useMemo(() => buildSelectCollection(children), [children])
    const optionsByKey = useMemo(
      () => new Map(collection.options.map((option) => [option.key, option])),
      [collection.options],
    )
    const controlledValue = value !== undefined ? toInputValue(value) : undefined
    const uncontrolledValue = defaultValue !== undefined ? toInputValue(defaultValue) : undefined
    const resolvedState = resolveFieldState({
      disabled,
      required,
      isDisabled,
      isRequired,
      isInvalid,
      ariaInvalid,
      errorMessage,
    })

    const selectedKey =
      controlledValue !== undefined
        ? (collection.valueToKey.get(controlledValue) ?? null)
        : undefined
    const defaultSelectedKey =
      controlledValue === undefined
        ? uncontrolledValue !== undefined
          ? (collection.valueToKey.get(uncontrolledValue) ?? null)
          : (collection.options[0]?.key ?? null)
        : undefined

    const state = useSelectState<SelectOptionRecord>({
      children: collection.collectionChildren,
      disabledKeys: collection.disabledKeys,
      selectedKey,
      defaultSelectedKey: defaultSelectedKey ?? undefined,
      onSelectionChange: (key) => {
        const option = key != null ? optionsByKey.get(String(key)) : undefined
        onChange?.(buildSelectChangeEvent(name, option?.value ?? ""))
      },
      isDisabled: resolvedState.isDisabled,
      isRequired: resolvedState.isRequired,
      isInvalid: resolvedState.isInvalid,
      label,
      description,
      errorMessage,
      onBlur: onBlur as React.FocusEventHandler<Element> | undefined,
      onFocus: onFocus as React.FocusEventHandler<Element> | undefined,
      onKeyDown: onKeyDown as React.KeyboardEventHandler<Element> | undefined,
      onKeyUp: onKeyUp as React.KeyboardEventHandler<Element> | undefined,
    })

    const {
      labelProps,
      triggerProps,
      valueProps,
      menuProps,
      descriptionProps,
      errorMessageProps,
      hiddenSelectProps,
      isInvalid: hookIsInvalid,
      validationErrors,
    } = useSelect(
      {
        ...rest,
        id: triggerId,
        disabledKeys: collection.disabledKeys,
        selectedKey,
        defaultSelectedKey: defaultSelectedKey ?? undefined,
        isDisabled: resolvedState.isDisabled,
        isRequired: resolvedState.isRequired,
        isInvalid: resolvedState.isInvalid,
        label,
        description,
        errorMessage,
        name,
        autoComplete,
        form,
        "aria-describedby": ariaDescribedBy,
        onBlur: onBlur as React.FocusEventHandler<Element> | undefined,
        onFocus: onFocus as React.FocusEventHandler<Element> | undefined,
        onKeyDown: onKeyDown as React.KeyboardEventHandler<Element> | undefined,
        onKeyUp: onKeyUp as React.KeyboardEventHandler<Element> | undefined,
      },
      state,
      buttonRef,
    )

    const { buttonProps } = useButton(triggerProps, buttonRef)
    const resolvedErrorMessage =
      errorMessage ??
      (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)
    const isFloated = state.isFocused || state.selectedItem != null

    return (
      <div ref={wrapperRef} className={cx(fieldRootCss, className)}>
        <div
          className={cx(fieldControlCss, selectRootCss)}
          data-focused={state.isFocused ? "true" : "false"}
          data-floated={isFloated ? "true" : "false"}
          data-invalid={hookIsInvalid ? "true" : "false"}
        >
          <HiddenSelect {...hiddenSelectProps} />

          <button {...buttonProps} ref={buttonRef} className={resolveSelectTriggerCss(fieldSize)}>
            <span {...valueProps} className={triggerValueCss}>
              {state.selectedItem?.rendered ?? null}
            </span>
            <span className={triggerChevronCss} aria-hidden="true">
              <span className={comboChevronCss} />
            </span>
          </button>

          <span {...labelProps} className={resolveSelectLabelCss(fieldSize)}>
            {label}
          </span>

          {state.isOpen ? (
            <Popover popoverRef={popoverRef} state={state} triggerRef={buttonRef}>
              <ListBox {...menuProps} state={state} />
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
  },
)
