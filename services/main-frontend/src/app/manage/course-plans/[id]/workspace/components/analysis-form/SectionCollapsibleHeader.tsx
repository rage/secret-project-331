"use client"

import { ArrowDown } from "@vectopus/atlas-icons-react"
import type { ReactNode } from "react"

import {
  analysisSectionBodyId,
  analysisSectionHeadingId,
  type AnalysisSectionIndex,
  ICON_SIZE_SECTION,
  ICON_SIZE_SECTION_BADGE,
  SECTION_HEADER_ICONS,
  sectionChevronStyles,
  sectionHeaderIconWrapStyles,
  sectionHeaderRowStyles,
  sectionTitleStyles,
  sectionToggleStyles,
} from "./analysisFormDomain"

/**
 * Collapsible section title row: expand chevron, thematic Atlas icon, and heading text.
 */
export default function SectionCollapsibleHeader(props: {
  sectionNum: AnalysisSectionIndex
  expanded: boolean
  onToggle: () => void
  title: ReactNode
}) {
  const { sectionNum, expanded, onToggle, title } = props
  const Icon = SECTION_HEADER_ICONS[sectionNum - 1] ?? SECTION_HEADER_ICONS[0]
  const headingId = analysisSectionHeadingId(sectionNum)
  const bodyControlsId = analysisSectionBodyId(sectionNum)
  return (
    <div className={sectionHeaderRowStyles}>
      <button
        type="button"
        className={sectionToggleStyles}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyControlsId}
      >
        <span className={sectionChevronStyles(expanded)} aria-hidden>
          <ArrowDown size={ICON_SIZE_SECTION} />
        </span>
        <span className={sectionHeaderIconWrapStyles} aria-hidden>
          <Icon size={ICON_SIZE_SECTION_BADGE} />
        </span>
        <span className={sectionTitleStyles} id={headingId}>
          {title}
        </span>
      </button>
    </div>
  )
}
