"use client"

import { css } from "@emotion/css"
import type { ListState } from "@react-stately/list"
import type { Node } from "@react-types/shared"
import { useListBoxSection } from "react-aria"

import { Option } from "./Option"

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

/** Renders a labeled section grouping options in a list box. */
export function Section<T extends object>({
  section,
  state,
}: {
  section: Node<T>
  state: ListState<T>
}) {
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
