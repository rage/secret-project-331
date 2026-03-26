"use client"

import { cx } from "@emotion/css"
import type { ListState } from "@react-stately/list"
import React from "react"
import { useListBox } from "react-aria"
import type { AriaListBoxOptions } from "react-aria"
import { useTranslation } from "react-i18next"

import { listBoxCss, listBoxEmptyStateCss } from "../selectStyles"

import { Option } from "./Option"
import { Section } from "./Section"

type ListBoxProps<T extends object> = AriaListBoxOptions<T> & {
  state: ListState<T>
  listBoxRef?: React.RefObject<HTMLUListElement | null>
  className?: string
  emptyState?: React.ReactNode
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
