"use client"

import { css } from "@emotion/css"
import React from "react"

import { settingsCardCss } from "@/styles/sharedStyles"

export interface SectionCardProps {
  /** Rendered as an `h2`, so callers must sit directly under the page's `h1`. */
  title: string
  children: React.ReactNode
}

const headingCss = css`
  margin: 0 0 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-gray-100);
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-gray-700);
`

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-start;

  p {
    margin: 0;
    color: var(--color-gray-700);
    line-height: 1.55;
  }
`

const SectionCard: React.FC<SectionCardProps> = ({ title, children }) => (
  <section className={settingsCardCss}>
    <h2 className={headingCss}>{title}</h2>
    <div className={bodyCss}>{children}</div>
  </section>
)

export default SectionCard
