"use client"

import { css, cx } from "@emotion/css"
import type { ComponentType, ReactNode } from "react"

import { sectionBodyStyles, sectionCardStyles } from "./analysis-form/analysisFormDomain"
import SectionCollapsibleHeader from "./analysis-form/SectionCollapsibleHeader"

const fieldsetStyles = css`
  display: contents;
`

/** One collapsible card of a stage form. */
export default function WorkspaceFormSection(props: {
  /** Target of the section navigation links and the scroll-spy. */
  domId: string
  icon: ComponentType<{ size?: number | string }>
  title: ReactNode
  accentClassName: string
  expanded: boolean
  onToggle: () => void
  /** Disables every control in the body. */
  isReadOnly: boolean
  children: ReactNode
}) {
  const { domId, icon, title, accentClassName, expanded, onToggle, isReadOnly, children } = props
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
      />
      {expanded ? (
        <div id={bodyId} className={sectionBodyStyles}>
          <fieldset className={fieldsetStyles} disabled={isReadOnly}>
            {children}
          </fieldset>
        </div>
      ) : null}
    </section>
  )
}
