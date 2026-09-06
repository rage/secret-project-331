"use client"

import { css, cx } from "@emotion/css"
import { Item } from "@react-stately/collections"
import { useListState } from "@react-stately/list"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import React, { useId, useMemo, useRef, useState } from "react"
import { FocusScope, useFilter, useFocusWithin, VisuallyHidden } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import type { ComboBoxItemAccessors } from "../lib/utils/combobox"
import { normalizeComboBoxItems } from "../lib/utils/combobox"
import { resolveFieldDescribedBy } from "../lib/utils/field"
import { omitUndefined } from "../lib/utils/nullability"
import { Chip } from "./Chip"
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

export type MultiSelectKey = string | number

const FILTER_SENSITIVITY = "base" as const
const SELECTION_MODE_MULTIPLE = "multiple" as const
const ARROW_DOWN_KEY = "ArrowDown"
const SPAN_ELEMENT = "span" as const

const rootCss = css`
  position: relative;
`

const surfaceCss = css`
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--space-2);
  cursor: default;
`

const triggerCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex: 1 1 6rem;
  min-width: 4rem;
  align-self: stretch;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--control-radius);
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }
`

const chevronCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--field-chrome);
`

const searchRowCss = css`
  position: relative;
  padding: var(--space-2) var(--space-3) 0;
`

const searchIconCss = css`
  position: absolute;
  left: calc(var(--space-3) + var(--space-3));
  top: 50%;
  display: inline-flex;
  transform: translateY(-25%);
  color: var(--field-chrome);
  pointer-events: none;
`

const searchInputCss = css`
  width: 100%;
  min-height: 2.5rem;
  padding: 0 var(--space-4) 0 2.5rem;
  border: none;
  border-radius: 999px;
  background: var(--field-bg);
  box-shadow: inset 0 0 0 1px var(--field-border);
  color: var(--field-text-color);
  font: inherit;
  outline: none;

  &:focus-visible {
    box-shadow: none;
    outline: 2px solid var(--field-border-color-focus);
  }
`

/**
 * Filterable picker for several values at once: the picked ones sit in the control as removable
 * tags and the rest stay in a searchable list.
 *
 * Uses react-hook-form; pass `name` and `control`. The field value is an array of item keys in
 * the order they were picked, so a tag keeps its place when another is added or dropped.
 *
 * Its sibling `ComboBox` is the single-value control, and `Select` the single-value one without
 * a filter.
 *
 * @example
 * <MultiSelect name="states" control={control} label="State" items={states}
 *   getItemKey={(state) => state.id} getItemTextValue={(state) => state.name} />
 */
export type MultiSelectProps<
  TItem,
  TField extends FieldValues = FieldValues,
  N extends Path<TField> = Path<TField>,
> = RhfFieldProps<TField, N> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  items: Iterable<TItem>
  /** Renders one option; defaults to its text value. */
  children?: (item: TItem) => React.ReactNode
  getItemKey: (item: TItem) => MultiSelectKey
  /** What the filter matches against, and the tag's label. */
  getItemTextValue: (item: TItem) => string
  getItemDisabled?: (item: TItem) => boolean
  /** Shown in the control while nothing is picked. */
  placeholder?: React.ReactNode
  /** Accessible name and placeholder for the filter box. Defaults to a shared-module string. */
  searchLabel?: string
  /** Shown in the list when the filter matches nothing. */
  emptyState?: React.ReactNode
  id?: string
  className?: string
}

export function MultiSelect<
  TItem,
  TField extends FieldValues,
  N extends Path<TField> = Path<TField>,
>(props: MultiSelectProps<TItem, TField, N>) {
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
    items,
    children,
    getItemKey,
    getItemTextValue,
    getItemDisabled,
    placeholder,
    searchLabel,
    emptyState,
    className,
  } = props

  const { t } = useTranslation("shared-module")
  const { field, resolvedError, isInvalid } = useRhfField({
    name,
    control,
    ...omitUndefined({ rules }),
    errorMessage,
  })

  const generatedId = useId()
  const controlId = id ?? generatedId
  const labelId = `${generatedId}-label`
  const summaryId = `${generatedId}-summary`
  const descriptionId = `${generatedId}-description`
  const errorMessageId = `${generatedId}-error`

  const surfaceRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const listBoxRef = useRef<HTMLUListElement>(null)

  const [query, setQuery] = useState("")
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const overlayState = useOverlayTriggerState({})

  const { focusWithinProps } = useFocusWithin({
    onFocusWithinChange: setIsFocusWithin,
    onBlurWithin: () => field.onBlur(),
  })

  const accessors = useMemo<ComboBoxItemAccessors<TItem>>(
    () => ({
      getItemKey,
      getItemTextValue,
      ...omitUndefined({ getItemDisabled, renderItem: children }),
    }),
    [children, getItemDisabled, getItemKey, getItemTextValue],
  )
  const normalizedItems = useMemo(
    () => normalizeComboBoxItems(items, accessors),
    [accessors, items],
  )
  const itemByKey = useMemo(
    () => new Map(normalizedItems.map((item) => [String(item.key), item])),
    [normalizedItems],
  )
  const disabledKeys = useMemo(
    () => normalizedItems.filter((item) => item.isDisabled).map((item) => String(item.key)),
    [normalizedItems],
  )

  const { contains } = useFilter({ sensitivity: FILTER_SENSITIVITY })
  const visibleItems = useMemo(
    () =>
      query.trim() === ""
        ? normalizedItems
        : normalizedItems.filter((item) => contains(item.textValue, query)),
    [contains, normalizedItems, query],
  )

  const pickedKeys: MultiSelectKey[] = Array.isArray(field.value)
    ? (field.value as MultiSelectKey[])
    : []
  const selectedKeys = new Set(pickedKeys.map(String))

  const listState = useListState({
    items: visibleItems,
    children: (item) => (
      <Item key={item.key} textValue={item.textValue}>
        {item.rendered}
      </Item>
    ),
    disabledKeys,
    selectionMode: SELECTION_MODE_MULTIPLE,
    selectedKeys,
    onSelectionChange: (keys) => {
      const next =
        keys === "all" ? new Set(normalizedItems.map((item) => String(item.key))) : new Set(keys)
      const kept = pickedKeys.filter((key) => next.has(String(key)))
      const keptKeys = new Set(kept.map(String))
      const added = normalizedItems
        .filter((item) => next.has(String(item.key)) && !keptKeys.has(String(item.key)))
        .map((item) => item.key)
      field.onChange([...kept, ...added])
    },
  })

  const removeKey = (key: MultiSelectKey) => {
    field.onChange(pickedKeys.filter((picked) => String(picked) !== String(key)))
  }

  const resolvedSearchLabel = searchLabel ?? t("multiSelect.search")
  // A placeholder is drawn in the same band as the resting label, so one has to give way.
  const isFloated = overlayState.isOpen || pickedKeys.length > 0 || placeholder !== undefined
  const describedBy = resolveFieldDescribedBy({
    descriptionId,
    errorMessageId,
    hasDescription: Boolean(description),
    hasErrorMessage: Boolean(resolvedError),
  })

  return (
    <div className={cx(fieldRootCss, className)}>
      <div
        className={cx(fieldControlCss, rootCss)}
        data-disabled={isDisabled ? "true" : "false"}
        data-field-control="true"
        data-floated={isFloated ? "true" : "false"}
        data-focused={isFocusWithin ? "true" : "false"}
        data-invalid={isInvalid ? "true" : "false"}
        {...focusWithinProps}
      >
        <div
          aria-labelledby={labelId}
          className={cx(resolveSelectTriggerCss(fieldSize), surfaceCss)}
          ref={surfaceRef}
          role="group"
        >
          {pickedKeys.map((key) => {
            const text = itemByKey.get(String(key))?.textValue ?? String(key)
            return (
              <Chip
                key={String(key)}
                onRemove={() => removeKey(key)}
                removeLabel={t("multiSelect.remove", { value: text })}
              >
                {text}
              </Chip>
            )
          })}
          <button
            aria-controls={overlayState.isOpen ? `${controlId}-listbox` : undefined}
            aria-describedby={describedBy}
            aria-expanded={overlayState.isOpen}
            aria-haspopup="listbox"
            aria-labelledby={`${labelId} ${summaryId}`}
            className={triggerCss}
            disabled={isDisabled}
            id={controlId}
            onClick={() => overlayState.toggle()}
            type="button"
          >
            <VisuallyHidden elementType={SPAN_ELEMENT} id={summaryId}>
              {pickedKeys.length === 0
                ? t("multiSelect.nothingPicked")
                : t("multiSelect.pickedCount", { amount: pickedKeys.length })}
            </VisuallyHidden>
            {pickedKeys.length === 0 && placeholder !== undefined ? (
              <span aria-hidden="true" className={selectTriggerValuePlaceholderCss}>
                {placeholder}
              </span>
            ) : null}
            <span aria-hidden="true" className={chevronCss}>
              <span className={comboChevronCss} />
            </span>
          </button>
        </div>

        <span className={resolveSelectLabelCss(fieldSize)} id={labelId}>
          {label}
        </span>

        {overlayState.isOpen ? (
          <Popover popoverRef={popoverRef} state={overlayState} triggerRef={surfaceRef}>
            {/*oxlint-disable-next-line jsx-a11y/no-autofocus*/}
            <FocusScope autoFocus>
              <div className={searchRowCss}>
                <span aria-hidden="true" className={searchIconCss}>
                  <MagnifyingGlass size={16} weight="bold" />
                </span>
                <input
                  aria-label={resolvedSearchLabel}
                  className={searchInputCss}
                  onChange={(changeEvent) => setQuery(changeEvent.target.value)}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === ARROW_DOWN_KEY) {
                      keyEvent.preventDefault()
                      listBoxRef.current?.focus()
                    }
                  }}
                  placeholder={resolvedSearchLabel}
                  type="search"
                  value={query}
                />
              </div>
              <ListBox
                aria-labelledby={labelId}
                emptyState={emptyState}
                id={`${controlId}-listbox`}
                listBoxRef={listBoxRef}
                // The press that opens a listbox must not also pick whatever it is released
                // over: a long list is clamped to the viewport and can cover the control.
                shouldSelectOnPressUp={false}
                state={listState}
              />
            </FocusScope>
          </Popover>
        ) : null}
      </div>

      {resolvedError ? (
        <p className={resolveMessageCss(fieldSize, true)} id={errorMessageId} role="alert">
          {resolvedError}
        </p>
      ) : description ? (
        <p className={resolveMessageCss(fieldSize, false)} id={descriptionId}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
