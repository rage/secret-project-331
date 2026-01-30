"use client"

import { css } from "@emotion/css"
import React, { DOMAttributes } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

const buttonStyle = (clicked: boolean) => css`
  ${clicked && `box-shadow: inset 0 0 0 2px ${baseTheme.colors.green[400]};`}
`

export const citationId = (cit_n: string, idx: string) => {
  // cit_n = citation number, idx = makes this id unique
  // eslint-disable-next-line i18next/no-literal-string
  return `chatbot-citation-${cit_n}-${idx}`
}

interface CitationButtonProps {
  citN: string
  citNToShow: string
  idx: string
  citationButtonClicked: boolean
  currentTriggerId: string | undefined
  handleClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  hoverCitationProps: DOMAttributes<HTMLButtonElement>
}

const CitationButton: React.FC<CitationButtonProps> = ({
  citN,
  citNToShow,
  idx,
  citationButtonClicked,
  currentTriggerId,
  handleClick,
  hoverCitationProps,
}) => {
  let { t } = useTranslation()
  return (
    <button
      className={buttonStyle(citationButtonClicked && currentTriggerId === citationId(citN, idx))}
      id={citationId(citN, idx)}
      aria-label={t("citation-n", { n: citNToShow })}
      onClick={(e) => handleClick(e)}
      {...hoverCitationProps}
    >
      {citNToShow}
    </button>
  )
}

export default CitationButton
