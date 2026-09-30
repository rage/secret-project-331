"use client"

import { css, cx } from "@emotion/css"

import type { ChartExplanation, ChartPart } from "./progressText"

/** A chart's tooltip content: one line per part of the chart, led by that part's colour. */
const ChartExplanationList: React.FC<{
  explanations: ChartExplanation[]
  colors: Record<ChartPart, string>
}> = ({ explanations, colors }) => (
  <ul className={listCss}>
    {explanations.map((explanation) => (
      <li key={explanation.part} className={itemCss}>
        <span
          className={cx(
            dotCss,
            css`
              background: ${colors[explanation.part]};
            `,
          )}
          aria-hidden="true"
        />
        <bdi>{explanation.text}</bdi>
      </li>
    ))}
  </ul>
)

export default ChartExplanationList

const listCss = css`
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: start;
`

const itemCss = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
`

// The ring keeps the palest colours visible on the white tooltip.
const dotCss = css`
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);

  @media (forced-colors: active) {
    forced-color-adjust: none;
    border: 1px solid CanvasText;
  }
`
