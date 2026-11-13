"use client"

import { css, cx } from "@emotion/css"
import React from "react"

import { atLeast } from "../styles/breakpoints"

export type FormSectionHeadingLevel = 2 | 3 | 4

export interface FormSectionProps {
  /**
   * Leave unset when the section's first field already asks the question, e.g. a `RadioGroup`
   * whose label is `questionLegendCss`-styled; a second heading would repeat it.
   */
  title?: React.ReactNode
  description?: React.ReactNode
  /** Defaults to 3. Pick the level that continues the page's outline. */
  headingLevel?: FormSectionHeadingLevel
  children: React.ReactNode
  className?: string
  "data-testid"?: string | undefined
}

const rootCss = css`
  padding: var(--space-4-5) 0;
  border-top: 1px solid var(--color-gray-100);

  ${atLeast("sm")} {
    padding: var(--space-5) 0;
  }
`

/** The section title's style, for a heading of the same weight nested inside a section. */
export const formSectionTitleCss = css`
  margin: 0 0 var(--space-3-5);
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
  font-weight: 600;
  line-height: 1.3;
`

const descriptionCss = css`
  max-width: 68ch;
  margin: calc(var(--space-3-5) * -0.5) 0 var(--space-3-5);
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/** One band of a long form, set off from the previous band by a hairline. */
export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  headingLevel = 3,
  children,
  className,
  "data-testid": dataTestId,
}) => {
  const titleId = React.useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      className={cx(rootCss, className)}
      aria-labelledby={title ? titleId : undefined}
      data-testid={dataTestId}
    >
      {title ? (
        <Heading id={titleId} className={formSectionTitleCss}>
          {title}
        </Heading>
      ) : null}
      {description ? <p className={descriptionCss}>{description}</p> : null}
      {children}
    </section>
  )
}
