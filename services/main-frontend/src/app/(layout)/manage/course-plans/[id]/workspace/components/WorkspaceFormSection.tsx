"use client"

import { cx } from "@emotion/css"
import type { ComponentType, ReactNode } from "react"

import type { CourseDesignerStage } from "@/generated/api/types.generated"

import { sectionBodyStyles, sectionCardStyles } from "./analysis-form/analysisFormDomain"
import SectionCollapsibleHeader from "./analysis-form/SectionCollapsibleHeader"
import { SectionStatusBadge } from "./section-status/SectionStatusBadge"
import SectionStatusEditor from "./section-status/SectionStatusEditor"

/** One collapsible card of a stage form, with its Ready/Unfinished mark in the header and footer. */
export default function WorkspaceFormSection(props: {
  /** Target of the section navigation links and the scroll-spy. */
  domId: string
  stage: CourseDesignerStage
  sectionKey: string
  icon: ComponentType<{ size?: number | string }>
  title: ReactNode
  accentClassName: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { domId, stage, sectionKey, icon, title, accentClassName, expanded, onToggle, children } =
    props
  const headingId = `${domId}-heading`
  const bodyId = `${domId}-body`
  return (
    <section
      className={cx(sectionCardStyles, accentClassName)}
      id={domId}
      aria-labelledby={headingId}
    >
      <SectionCollapsibleHeader
        icon={icon}
        headingId={headingId}
        bodyId={bodyId}
        expanded={expanded}
        onToggle={onToggle}
        title={title}
        trailing={<SectionStatusBadge stage={stage} sectionKey={sectionKey} />}
      />
      {expanded ? (
        <div id={bodyId} className={sectionBodyStyles}>
          {children}
          <SectionStatusEditor stage={stage} sectionKey={sectionKey} />
        </div>
      ) : null}
    </section>
  )
}
