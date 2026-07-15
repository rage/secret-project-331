"use client"

import { css, cx } from "@emotion/css"
import { useSelectState } from "@react-stately/select"
import { useSearchFieldState } from "@react-stately/searchfield"
import { useAutocompleteState } from "@react-stately/autocomplete"
import React, { useId, useMemo, useRef, useState } from "react"
import {
  mergeProps,
  useButton,
  useSelect,
  useSearchField,
  useFilter,
  useAutocomplete,
  FocusScope,
} from "react-aria"
import type { FieldValues, Path } from "react-hook-form"
import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { composeRefs } from "../lib/utils/compositeField"
import { toInputValue } from "../lib/utils/field"
import { resolveRenderedErrorMessage } from "../lib/utils/floatingField"
import { omitUndefined } from "../lib/utils/nullability"
import {
  buildSelectCollectionNodes,
  type NormalizedSelectOption,
  normalizeSelectOptions,
  type SelectOption,
  type SelectOptionGroup,
} from "../lib/utils/select"
import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveMessageCss,
  resolveSelectLabelCss,
  resolveSelectTriggerCss,
  selectTriggerValuePlaceholderCss,
} from "./primitives/fieldStyles"
import { ListBox } from "./primitives/ListBox"
import { Popover } from "./primitives/popover"
import { comboChevronCss } from "./primitives/selectStyles"

export type { SelectOption, SelectOptionGroup }

/**
 * Custom select (listbox + button trigger) with label and error display.
 * Uses react-hook-form; pass `name` and `control`. Field value is the option `value` string.
 *
 * @example
 * <Select name="role" control={control} label="Role" options={[{ value: "a", label: "A" }]} />
 */
export type SelectProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isRequired?: boolean
  options: readonly (SelectOption | SelectOptionGroup)[]
  placeholder?: React.ReactNode
  id?: string
  autoComplete?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>
  className?: string
  searchEnabled?: boolean
  searchPlaceholder?: string
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

const searchfieldCss = css`
  margin: 0 6px;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 999px;
  padding: 0 2rem;
  width: 99%;
  outline: none;
  border: none;
  box-shadow: inset 0 0 0 1px var(--field-border);
  min-height: 2.5rem;
  &:focus-visible {
    box-shadow: none;
    outline: 2px solid var(--field-border-color-focus);
  }
`

export function Select<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: SelectProps<T, N>,
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
    isDisabled = false,
    isRequired = false,
    className,
    options,
    placeholder,
    autoComplete,
    onKeyDown,
    onKeyUp,
    searchEnabled = false,
    searchPlaceholder = "search",
  } = props

  const [filterValue, setFilterValue] = useState("")

  let { contains } = useFilter({
    // oxlint-disable-next-line i18next/no-literal-string
    sensitivity: "base",
  })

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })

  const generatedInputId = useId()
  const triggerId = id ?? generatedInputId
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const listBoxRef = useRef(null)
  const hasFocusWithinRef = useRef(false)

  const normalizedCollection = useMemo(() => normalizeSelectOptions(options), [options])

  const collectionChildren = buildSelectCollectionNodes({
    ...normalizedCollection,
    options: normalizedCollection.options.filter((option) =>
      contains(option.textValue, filterValue),
    ),
  })

  const optionsByKey = useMemo(
    () => new Map(normalizedCollection.options.map((option) => [option.key, option])),
    [normalizedCollection.options],
  )

  const selectedKey = normalizedCollection.valueToKey.get(toInputValue(field.value)) ?? null

  const state = useSelectState<NormalizedSelectOption>({
    children: collectionChildren as never,
    disabledKeys: normalizedCollection.disabledKeys,
    value: selectedKey,
    onSelectionChange: (key) => {
      const selectedOption = key !== null ? optionsByKey.get(String(key)) : undefined
      const nextValue = selectedOption?.value ?? ""
      field.onChange(nextValue)
    },
    isDisabled,
    isRequired,
    isInvalid,
    label,
    description,
    errorMessage: resolvedError,
  })

  const searchFieldState = useSearchFieldState({
    value: filterValue,
    onChange: setFilterValue,
  })

  const autoCompleteState = useAutocompleteState({})

  const {
    inputProps: autoCompleteInputProps,
    collectionProps,
    collectionRef: mergedCollectionRef,
  } = useAutocomplete(
    {
      inputRef: searchRef,
      collectionRef: listBoxRef,
    },
    autoCompleteState,
  )

  const {
    triggerProps,
    valueProps,
    menuProps,
    descriptionProps,
    errorMessageProps,
    isInvalid: hookIsInvalid,
    validationErrors,
  } = useSelect(
    {
      id: triggerId,
      disabledKeys: normalizedCollection.disabledKeys,
      value: selectedKey,
      isDisabled,
      isRequired,
      isInvalid,
      label,
      description,
      errorMessage: resolvedError,
      name: field.name,
      ...omitUndefined({ autoComplete }),
    },
    state,
    buttonRef,
  )

  const { buttonProps } = useButton(triggerProps, buttonRef)
  const { labelProps, inputProps } = useSearchField(
    { ...autoCompleteInputProps, placeholder: searchPlaceholder },
    searchFieldState,
    searchRef,
  )

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
    field.onBlur()
  }

  const emitCompositeFocus = () => {
    if (hasFocusWithinRef.current) {
      return
    }

    hasFocusWithinRef.current = true
  }

  const mergedButtonProps = mergeProps(buttonProps, {
    onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
      emitCompositeBlur(event.relatedTarget)
    },
    onFocus: () => {
      emitCompositeFocus()
    },
    onKeyDown,
    onKeyUp,
  })

  const resolvedRenderedError = resolveRenderedErrorMessage(
    resolvedError,
    hookIsInvalid,
    validationErrors,
  )
  const selectedOption =
    state.selectedKey !== null ? optionsByKey.get(String(state.selectedKey)) : undefined
  const isPlaceholderState = selectedOption === undefined
  const isFloated = state.isOpen || selectedOption !== undefined

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
        <button
          {...mergedButtonProps}
          ref={composeRefs(buttonRef, field.ref)}
          className={resolveSelectTriggerCss(fieldSize)}
          type="button"
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
            <FocusScope autoFocus>
              {searchEnabled && (
                <div
                  className={css`
                    position: relative;
                  `}
                >
                  <span
                    className={css`
                      transform: scaleX(-1);
                      font-size: 2rem;
                      display: inline-block;
                      position: absolute;
                      left: 1rem;
                    `}
                  >
                    &#x2315;
                  </span>
                  <input className={searchfieldCss} {...inputProps} ref={searchRef} />
                </div>
              )}

              <ListBox
                {...mergeProps(menuProps, collectionProps)}
                state={state}
                listBoxRef={mergedCollectionRef}
              />
            </FocusScope>
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
