"use client"

import { css, cx } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"

import { linkifyResourceLine } from "./analysis-form/analysisFormDomain"

const guidanceStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  p {
    font-size: 0.9rem;
    color: ${baseTheme.colors.gray[700]};
    line-height: 1.6;
    margin: 0;
  }
`

/**
 * Renders translated guidance prose: blank lines separate paragraphs and URLs and email
 * addresses become links.
 */
export default function GuidanceText(props: { text: string; className?: string }) {
  const paragraphs = props.text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
  return (
    <div className={cx(guidanceStyles, props.className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{linkifyResourceLine(paragraph)}</p>
      ))}
    </div>
  )
}
