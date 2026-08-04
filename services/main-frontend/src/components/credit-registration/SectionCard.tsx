"use client"

import { css } from "@emotion/css"
import React from "react"

import { settingsCardCss } from "@/styles/sharedStyles"

export interface SectionCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

const headerCss = css`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-gray-100);

  h3 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }
`

const iconChipCss = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--color-green-75);
  color: var(--color-green-700);
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

const SectionCard: React.FC<SectionCardProps> = ({ icon, title, children }) => (
  <div className={settingsCardCss}>
    <div className={headerCss}>
      <div className={iconChipCss} aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
    </div>
    <div className={bodyCss}>{children}</div>
  </div>
)

export default SectionCard
