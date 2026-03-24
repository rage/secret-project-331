"use client"

import { css, cx } from "@emotion/css"
import type { ListState } from "@react-stately/list"
import type { Node } from "@react-types/shared"
import React from "react"
import { useListBox, useListBoxSection, useOption } from "react-aria"
import type { AriaListBoxOptions } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  comboSelectedMarkCss,
  listBoxCss,
  listBoxEmptyStateCss,
  listBoxOptionCss,
} from "./selectStyles"

const sectionCss = css`
  display: grid;
  gap: var(--space-1);
`

const sectionHeadingCss = css`
  padding: var(--space-2) var(--space-3) 0;
  color: var(--field-label-color);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.35;
`

const sectionGroupCss = css`
  margin: 0;
  padding: 0;
  list-style: none;
`

type ListBoxProps<T extends object> = AriaListBoxOptions<T> & {
  state: ListState<T>
  listBoxRef?: React.RefObject<HTMLUListElement | null>
  className?: string
  emptyState?: React.ReactNode
}

function Option<T extends object>({ item, state }: { item: Node<T>; state: ListState<T> }) {
  const ref = React.useRef<HTMLLIElement>(null)
  const { optionProps, isDisabled, isFocused, isFocusVisible, isSelected } = useOption(
    { key: item.key },
    state,
    ref,
  )

  return (
    <li
      {...optionProps}
      ref={ref}
      className={listBoxOptionCss}
      data-disabled={isDisabled ? "true" : "false"}
      data-focus-visible={isFocusVisible ? "true" : "false"}
      data-highlighted={isFocused ? "true" : "false"}
      data-key={String(item.key)}
      data-selected={isSelected ? "true" : "false"}
    >
      <span>{item.rendered}</span>
      {isSelected ? <span className={comboSelectedMarkCss} aria-hidden="true" /> : null}
    </li>
  )
}

function Section<T extends object>({ section, state }: { section: Node<T>; state: ListState<T> }) {
  const { itemProps, headingProps, groupProps } = useListBoxSection({
    heading: section.rendered,
    "aria-label": section["aria-label"],
  })

  return (
    <li {...itemProps} className={sectionCss}>
      {section.rendered ? (
        <span {...headingProps} className={sectionHeadingCss}>
          {section.rendered}
        </span>
      ) : null}
      <ul {...groupProps} className={sectionGroupCss}>
        {Array.from(state.collection.getChildren?.(section.key) ?? []).map((item) => (
          <Option key={item.key} item={item} state={state} />
        ))}
      </ul>
    </li>
  )
}

export function ListBox<T extends object>({
  state,
  listBoxRef,
  className,
  emptyState,
  ...props
}: ListBoxProps<T>) {
  const { t } = useTranslation()
  const fallbackRef = React.useRef<HTMLUListElement>(null)
  const resolvedRef = listBoxRef ?? fallbackRef
  const { listBoxProps } = useListBox(props, state, resolvedRef)

  const collection = Array.from(state.collection)

  if (collection.length === 0) {
    return (
      <div className={listBoxEmptyStateCss} role="presentation">
        {emptyState ?? t("listBox.noResults")}
      </div>
    )
  }

  return (
    <ul {...listBoxProps} ref={resolvedRef} className={cx(listBoxCss, className)}>
      {collection.map((item) =>
        item.type === "section" ? (
          <Section key={item.key} section={item} state={state} />
        ) : (
          <Option key={item.key} item={item} state={state} />
        ),
      )}
    </ul>
  )
}
