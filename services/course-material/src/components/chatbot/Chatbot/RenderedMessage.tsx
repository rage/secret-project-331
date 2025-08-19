import { css } from "@emotion/css"
import React, { DOMAttributes } from "react"

import { baseTheme } from "@/shared-module/common/styles"
import { getRemarkable } from "@/utils/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

const messageStyle = (clicked: boolean) => css`
  flex: 1;
  table {
    margin: 20px 0 20px 0;
    border-collapse: collapse;
  }
  thead {
    background-color: ${baseTheme.colors.clear[200]};
  }
  tbody td {
    text-align: center;
    padding: 5px;
  }
  tbody tr:nth-child(odd) {
    background-color: #ffffff;
  }
  tbody tr:nth-child(even) {
    background-color: ${baseTheme.colors.clear[200]};
  }
  pre {
    /*the pre element corresponds to md raw text, this property
    will force long strings in it to wrap and not overflow */
    white-space: pre-wrap;
  }
  button {
    /*Citations are inside button tags, it's assumed button tags wouldn't
    be used otherwise in chatbot text*/
    border: none;
    cursor: default;
    background-color: ${baseTheme.colors.gray[200]};
    padding: 0 7px 0 7px;
    border-radius: 10px;
    font-size: 85%;
    &:hover {
      filter: brightness(0.9) contrast(1.1);
      transition: filter 0.2s;
    }
    ${clicked && `box-shadow: inset 0 0 0 2px ${baseTheme.colors.gray[400]};`}
  }
  h1 {
    font-size: x-large;
  }
  h2 {
    font-size: large;
  }
  h3 {
    font-size: medium;
  }
  h4,
  h5,
  h6 {
    font-size: small;
  }

  white-space: pre-wrap;
`

const citationId = (cit_n: number, idx: number) => {
  /* eslint-disable i18next/no-literal-string */
  return `cit-${cit_n}-${idx}`
}

export enum MessageRenderType {
  User,
  ChatbotNoCitations,
  ChatbotWithCitations,
}

interface CitationButtonProps {
  renderOption: MessageRenderType
  message: string
  pairs: {
    msg: string
    cit_n: number
  }[]
  citationButtonClicked: boolean
  currentRefId: string | undefined
  handleClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  hoverCitationProps: DOMAttributes<HTMLButtonElement>
}

let md = getRemarkable()

const RenderedMessage: React.FC<CitationButtonProps> = ({
  renderOption,
  message,
  pairs,
  citationButtonClicked,
  currentRefId,
  handleClick,
  hoverCitationProps,
}) => {
  if (renderOption === MessageRenderType.User) {
    return <span className={messageStyle(false)}>{message}</span>
  }
  let messageCopy = md.render(message).trim().slice(3, -4)

  if (renderOption === MessageRenderType.ChatbotNoCitations) {
    return (
      <span
        className={messageStyle(false)}
        dangerouslySetInnerHTML={{
          __html: sanitizeCourseMaterialHtml(messageCopy),
        }}
      ></span>
    )
  }

  return (
    <>
      {pairs.map(({ msg, cit_n }, idx) => (
        <span
          key={idx}
          className={messageStyle(citationButtonClicked && currentRefId === citationId(cit_n, idx))}
        >
          <span dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(msg) }}></span>
          {cit_n && (
            <button
              id={citationId(cit_n, idx)}
              {...hoverCitationProps}
              onClick={(e) => handleClick(e)}
            >
              {cit_n}
            </button>
          )}
        </span>
      ))}
    </>
  )
}

export default RenderedMessage
