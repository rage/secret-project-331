"use client"

import { css, cx } from "@emotion/css"
import { useSelectState } from "@react-stately/select"
import React, { useId, useImperativeHandle, useMemo, useRef } from "react"
import { mergeProps, useButton, useHiddenSelect, useSelect } from "react-aria"

import {
  composeRefs,
  emitSyntheticBlur,
  emitSyntheticChange,
  emitSyntheticFocus,
} from "../lib/utils/compositeField"
import { resolveFieldState, toInputValue } from "../lib/utils/field"
import { resolveRenderedErrorMessage } from "../lib/utils/floatingField"
import {
  buildSelectCollectionNodes,
  type NormalizedSelectOption,
  normalizeSelectOptions,
  type SelectOption,
  type SelectOptionGroup,
} from "../lib/utils/select"

import { ListBox } from "./primitives/ListBox"
import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveMessageCss,
  resolveSelectLabelCss,
  resolveSelectTriggerCss,
  selectTriggerValuePlaceholderCss,
} from "./primitives/fieldStyles"
import { Popover } from "./primitives/popover"
import { comboChevronCss } from "./primitives/selectStyles"

export type { SelectOption, SelectOptionGroup }

export type SelectProps = Omit<
  React.ComponentPropsWithoutRef<"select">,
  "children" | "multiple" | "size"
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  options: readonly (SelectOption | SelectOptionGroup)[]
  placeholder?: React.ReactNode
  onValueChange?: (value: string) => void
  inputRef?: React.Ref<HTMLSelectElement>
}

const selectRootCss = css`
  position: relative;
`

const hiddenSelectContainerCss = css`
  position: fixed;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
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
      options,
      placeholder,
      inputRef,
      value,
      defaultValue,
      onChange,
      onValueChange,
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
    const hiddenSelectRef = useRef<HTMLSelectElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const hasFocusWithinRef = useRef(false)

    useImperativeHandle(forwardedRef, () => buttonRef.current as HTMLButtonElement)

    const normalizedCollection = useMemo(() => normalizeSelectOptions(options), [options])
    const collectionChildren = useMemo(
      () => buildSelectCollectionNodes(normalizedCollection),
      [normalizedCollection],
    )
    const optionsByKey = useMemo(
      () => new Map(normalizedCollection.options.map((option) => [option.key, option])),
      [normalizedCollection.options],
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
        ? normalizedCollection.valueToKey.get(controlledValue)
        : undefined
    const defaultSelectedKey =
      controlledValue === undefined && uncontrolledValue !== undefined
        ? normalizedCollection.valueToKey.get(uncontrolledValue)
        : undefined
    const selectValue = controlledValue !== undefined ? (selectedKey ?? null) : undefined
    const selectDefaultValue =
      controlledValue === undefined && uncontrolledValue !== undefined
        ? (defaultSelectedKey ?? null)
        : undefined

    const state = useSelectState<NormalizedSelectOption>({
      children: collectionChildren as never,
      disabledKeys: normalizedCollection.disabledKeys,
      value: selectValue,
      defaultValue: selectDefaultValue,
      onSelectionChange: (key) => {
        const selectedOption = key != null ? optionsByKey.get(String(key)) : undefined
        const nextValue = selectedOption?.value ?? ""
        onValueChange?.(nextValue)
        emitSyntheticChange(hiddenSelectRef.current, onChange, nextValue)
      },
      isDisabled: resolvedState.isDisabled,
      isRequired: resolvedState.isRequired,
      isInvalid: resolvedState.isInvalid,
      label,
      description,
      errorMessage,
    })

    const {
      labelProps,
      triggerProps,
      valueProps,
      menuProps,
      descriptionProps,
      errorMessageProps,
      isInvalid: hookIsInvalid,
      validationErrors,
    } = useSelect(
      {
        ...rest,
        id: triggerId,
        disabledKeys: normalizedCollection.disabledKeys,
        value: selectValue,
        defaultValue: selectDefaultValue,
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
      },
      state,
      buttonRef,
    )

    const hiddenSelect = useHiddenSelect(
      {
        autoComplete,
        form,
        isDisabled: resolvedState.isDisabled,
        label,
        name,
        selectRef: hiddenSelectRef,
      },
      state,
      buttonRef,
    )
    const { buttonProps } = useButton(triggerProps, buttonRef)

    const emitCompositeBlur = (relatedTarget: EventTarget | null) => {
      const nextFocusedNode = relatedTarget as Node | null

      if (
        buttonRef.current?.contains(nextFocusedNode) ||
        popoverRef.current?.contains(nextFocusedNode)
      ) {
        return
      }

      if (!hasFocusWithinRef.current) {
        return
      }

      hasFocusWithinRef.current = false
      emitSyntheticBlur(hiddenSelectRef.current, onBlur)
    }

    const emitCompositeFocus = () => {
      if (hasFocusWithinRef.current) {
        return
      }

      hasFocusWithinRef.current = true
      emitSyntheticFocus(hiddenSelectRef.current, onFocus)
    }

    const mergedButtonProps = mergeProps(buttonProps, {
      onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
        emitCompositeBlur(event.relatedTarget)
      },
      onFocus: () => {
        emitCompositeFocus()
      },
      onKeyDown: onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined,
      onKeyUp: onKeyUp as React.KeyboardEventHandler<HTMLButtonElement> | undefined,
    })

    const resolvedErrorMessage = resolveRenderedErrorMessage(
      errorMessage,
      hookIsInvalid,
      validationErrors,
    )
    const selectedOption =
      state.selectedKey != null ? optionsByKey.get(String(state.selectedKey)) : undefined
    const isPlaceholderState = selectedOption == null
    const isFloated = state.isOpen || selectedOption != null

    return (
      <div className={cx(fieldRootCss, className)}>
        <div
          className={cx(fieldControlCss, selectRootCss)}
          data-field-control="true"
          data-focused={state.isFocused ? "true" : "false"}
          data-floated={isFloated ? "true" : "false"}
          data-invalid={hookIsInvalid ? "true" : "false"}
          data-placeholder={isPlaceholderState ? "true" : "false"}
        >
          <div {...hiddenSelect.containerProps} className={hiddenSelectContainerCss}>
            <label>
              {label}
              <select {...hiddenSelect.selectProps} ref={composeRefs(hiddenSelectRef, inputRef)}>
                <option value="" />
                {Array.from(state.collection.getKeys()).map((key) => {
                  const item = state.collection.getItem(key)

                  if (!item || item.type !== "item") {
                    return null
                  }

                  return (
                    <option key={item.key} value={item.key}>
                      {item.textValue}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>

          <button
            {...mergedButtonProps}
            ref={buttonRef}
            className={resolveSelectTriggerCss(fieldSize)}
          >
            <span
              {...valueProps}
              data-select-placeholder={isPlaceholderState ? "true" : undefined}
              className={cx(
                triggerValueCss,
                isPlaceholderState ? selectTriggerValuePlaceholderCss : undefined,
              )}
            >
              {selectedOption?.label ?? placeholder ?? null}
            </span>
            <span className={triggerChevronCss} aria-hidden="true">
              <span className={comboChevronCss} />
            </span>
          </button>

          <span {...labelProps} className={resolveSelectLabelCss(fieldSize)}>
            {label}
          </span>

          {state.isOpen ? (
            <Popover
              popoverRef={popoverRef}
              state={state}
              triggerRef={buttonRef}
              surfaceProps={{
                onBlur: (event) => {
                  emitCompositeBlur(event.relatedTarget)
                },
                onFocus: () => {
                  emitCompositeFocus()
                },
              }}
            >
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

Select.displayName = "Select"
