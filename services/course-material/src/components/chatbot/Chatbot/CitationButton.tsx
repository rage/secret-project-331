import { css } from "@emotion/css"
import React, { DOMAttributes } from "react"

import { baseTheme } from "@/shared-module/common/styles"

const buttonStyle = (clicked: boolean) => css`
  ${clicked && `box-shadow: inset 0 0 0 2px ${baseTheme.colors.gray[400]};`}
`

export const citationId = (cit_n: string, idx: string) => {
  // cit_n = citation number or doc number, idx = makes this id unique
  /* eslint-disable i18next/no-literal-string */
  return `chatbot-citation-${cit_n}-${idx}`
}

interface CitationButtonProps {
  citN: string
  idx: string
  citationButtonClicked: boolean
  currentRefId: string | undefined
  handleClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  hoverCitationProps: DOMAttributes<HTMLButtonElement>
}

const CitationButton: React.FC<CitationButtonProps> = ({
  citN,
  idx,
  citationButtonClicked,
  currentRefId,
  handleClick,
  hoverCitationProps,
}) => {
  return (
    <button
      className={buttonStyle(citationButtonClicked && currentRefId === citationId(citN, idx))}
      id={citationId(citN, idx)}
      {...hoverCitationProps}
      onClick={(e) => handleClick(e)}
    >
      {citN}
    </button>
  )
}

export default CitationButton
