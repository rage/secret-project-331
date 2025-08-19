import { css } from "@emotion/css"
import Markdown from "markdown-to-jsx"
import React, { DOMAttributes } from "react"

import CitationButton from "./CitationButton"

import { baseTheme } from "@/shared-module/common/styles"
//import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

// captures citations
const MATCH_CITATIONS_REGEX = /\[[\w]*?([\d]+)\]/g
// matches citations and a starting whitespace that should be removed
const REMOVE_CITATIONS_REGEX = /\s\[[\w]*?[\d]+\]/g

/* const getMessagePartsCitationPairs = (message: string, isFromChatbot: boolean) => {
  let citedDocs: number[] = []

  // if the message is from user, there are no citations for it so no need to
  // process further
  if (!isFromChatbot) {
    return { citedDocs, alteredMessage: message }
  }

  citedDocs = Array.from(message.matchAll(MATCH_CITATIONS_REGEX), (arr, _) => parseInt(arr[1]))
  let messageParts = message.split(SPLIT_AT_CITATIONS_REGEX)
  /* pairs = zipWith(messageParts, citedDocs, (m, c) => {
    return { msg: m, cit_n: c }
  })
  const messageNoCitations = message.replace(REMOVE_CITATIONS_REGEX, "")

  return { citedDocs, alteredMessage: message }
}
*/

const messageStyle = css`
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

export enum MessageRenderType {
  User,
  ChatbotNoCitations,
  ChatbotWithCitations,
}

interface RenderedMessageProps {
  renderOption: MessageRenderType
  message: string
  citationButtonClicked: boolean
  currentRefId: string | undefined
  handleClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  hoverCitationProps: DOMAttributes<HTMLButtonElement>
}

const RenderedMessage: React.FC<RenderedMessageProps> = ({
  renderOption,
  message,
  citationButtonClicked,
  currentRefId,
  handleClick,
  hoverCitationProps,
}) => {
  if (renderOption === MessageRenderType.User) {
    return <span className={messageStyle}>{message}</span>
  }

  if (renderOption === MessageRenderType.ChatbotNoCitations) {
    let renderedMessage = message.replace(REMOVE_CITATIONS_REGEX, "")
    return (
      <span className={messageStyle}>
        <Markdown>{renderedMessage}</Markdown>
      </span>
    )
  }

  let renderedMessage = message.replace(MATCH_CITATIONS_REGEX, (_match, p1, offset) => {
    // eslint-disable-next-line i18next/no-literal-string
    return `<CitationButton citN="${p1}" idx="${offset}" />`
  })

  return (
    <span className={messageStyle}>
      <Markdown
        options={{
          overrides: {
            CitationButton: {
              component: CitationButton,
              props: {
                citationButtonClicked: citationButtonClicked,
                currentRefId: currentRefId,
                handleClick: handleClick,
                hoverCitationProps: hoverCitationProps,
              },
            },
            script: () => null,
            button: () => null,
          },
          disableAutoLink: true,
        }}
      >
        {renderedMessage}
      </Markdown>
    </span>
  )
}

export default RenderedMessage
