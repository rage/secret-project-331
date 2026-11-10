"use client"

import { ArrowDown } from "@vectopus/atlas-icons-react"
import type { ComponentType, ReactNode } from "react"

import {
  ICON_SIZE_SECTION,
  ICON_SIZE_SECTION_BADGE,
  sectionChevronStyles,
  sectionHeaderIconWrapStyles,
  sectionHeaderRowStyles,
  sectionTitleStyles,
  sectionToggleStyles,
} from "./analysisFormDomain"

/**
 * Collapsible section title row: expand chevron, thematic Atlas icon, heading text and an
 * optional trailing slot (the section's status chip).
 */
export default function SectionCollapsibleHeader(props: {
  icon: ComponentType<{ size?: number | string }>
  headingId: string
  bodyId: string
  expanded: boolean
  onToggle: () => void
  title: ReactNode
  trailing?: ReactNode
}) {
  const { icon: Icon, headingId, bodyId, expanded, onToggle, title, trailing } = props
  return (
    <div className={sectionHeaderRowStyles}>
      <button
        type="button"
        className={sectionToggleStyles}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
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
      {trailing}
    </div>
  )
}
