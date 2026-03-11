"use client"

import { cx } from "@emotion/css"
import React from "react"

import {
  comboSelectedMarkCss,
  listBoxCss,
  listBoxEmptyStateCss,
  listBoxOptionCss,
} from "./selectStyles"

export type ListBoxItem<T> = {
  item: T
  key: React.Key
  rendered: React.ReactNode
  textValue: string
  isDisabled?: boolean
}

type ListBoxProps<T> = {
  items: ListBoxItem<T>[]
  selectedKey?: React.Key | null
  highlightedKey?: React.Key | null
  emptyState?: React.ReactNode
  idBase: string
  onAction: (item: ListBoxItem<T>) => void
}

// eslint-disable-next-line i18next/no-literal-string
const defaultEmptyState = "No results found"

export function ListBox<T>({
  items,
  selectedKey,
  highlightedKey,
  emptyState,
  idBase,
  onAction,
}: ListBoxProps<T>) {
  if (items.length === 0) {
    return (
      <div className={listBoxEmptyStateCss} role="presentation">
        {emptyState ?? defaultEmptyState}
      </div>
    )
  }

  return (
    <ul className={listBoxCss} role="listbox">
      {items.map((item) => {
        const isSelected = selectedKey === item.key
        const isHighlighted = highlightedKey === item.key

        return (
          <li
            id={`${idBase}-option-${String(item.key)}`}
            key={String(item.key)}
            className={cx(listBoxOptionCss)}
            role="option"
            aria-selected={isSelected}
            data-selected={isSelected ? "true" : "false"}
            data-highlighted={isHighlighted ? "true" : "false"}
            data-disabled={item.isDisabled ? "true" : "false"}
            tabIndex={item.isDisabled ? -1 : 0}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              if (!item.isDisabled) {
                onAction(item)
              }
            }}
            onKeyDown={(event) => {
              if (item.isDisabled) {
                return
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onAction(item)
              }
            }}
          >
            <span>{item.rendered}</span>
            {isSelected ? <span className={comboSelectedMarkCss} aria-hidden="true" /> : null}
          </li>
        )
      })}
    </ul>
  )
}
