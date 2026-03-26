"use client"

import type { ListState } from "@react-stately/list"
import type { Node } from "@react-types/shared"
import React from "react"
import { useOption } from "react-aria"

import { comboSelectedMarkCss, listBoxOptionCss } from "../selectStyles"

/** Renders a single selectable row in a list box. */
export function Option<T extends object>({ item, state }: { item: Node<T>; state: ListState<T> }) {
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
