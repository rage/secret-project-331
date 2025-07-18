import { css } from "@emotion/css"
import React, { useMemo } from "react"

import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"
import { getRemarkable } from "@/utils/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

interface MessageBubbleProps {
  message: string
  isFromChatbot: boolean
  isPending: boolean
  citations: ChatbotConversationMessageCitation[] | undefined
  hideCitations?: boolean
}

const bubbleStyle = (isFromChatbot: boolean, showCitations: boolean) => css`
  padding: 1rem;
  border-radius: 10px;
  width: fit-content;
  max-width: stretch;
  overflow-wrap: break-word;
  margin: 0.5rem 0;
  ${isFromChatbot
    ? `
      margin-right: 2rem;
      align-self: flex-start;
      background-color: ${baseTheme.colors.gray[100]};
    `
    : `
      margin-left: 2rem;
      align-self: flex-end;
      border: 2px solid ${baseTheme.colors.gray[200]};
      background-color: #ffffff;
    `}
  details {
    transition: all 0.6s ease-in-out;
  }
  details > summary {
    list-style: none;
  }
  ${showCitations
    ? `
      details > summary::after {
      content: ">";
      }
      details[open] > summary::after {
        content: "v";
      }
      details[open]::details-content {
        background-color: blue;
      }
    `
    : ``}
`

const messageStyle = css`
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
  span {
    background-color: ${baseTheme.colors.gray[200]};
    padding: 0 7px 0 7px;
    border-radius: 10px;
  }

  white-space: pre-wrap;
`

let md = getRemarkable()

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFromChatbot,
  isPending,
  citations,
  hideCitations,
}) => {
  const [processedMessage, processedCitations] = useMemo(() => {
    let renderedMessage = message
    renderedMessage = sanitizeCourseMaterialHtml(md.render(renderedMessage).trim())
    let filteredCitations: ChatbotConversationMessageCitation[] = []

    if (isFromChatbot) {
      if (citations && hideCitations) {
        renderedMessage = renderedMessage.replace(/\[[a-z]*?[0-9]+\]/g, "")
      } else if (citations) {
        let citedDocs = new Set(
          Array.from(renderedMessage.matchAll(/\[[a-z]*?([0-9]+)\]/g), (arr, _) =>
            parseInt(arr[1]),
          ),
        )
        // TODO is it bad to do two regex operations?
        //console.log("citedDocs: ", citedDocs)
        /* eslint-disable i18next/no-literal-string */
        renderedMessage = renderedMessage.replace(/\[[a-z]*?([0-9]+)\]/g, `<span>$1</span>`)

        filteredCitations = citations.filter((cit) => citedDocs.has(cit.citation_number))
      }
    }
    return [renderedMessage, filteredCitations]
  }, [hideCitations, message, citations, isFromChatbot])
  return (
    <div className={bubbleStyle(isFromChatbot, !hideCitations && processedCitations.length > 0)}>
      {!isFromChatbot && (
        <span
          className={messageStyle}
          dangerouslySetInnerHTML={{ __html: processedMessage }}
        ></span>
      )}
      {isFromChatbot && (
        <details>
          <summary>
            <span
              className={messageStyle}
              dangerouslySetInnerHTML={{ __html: processedMessage }}
            ></span>
          </summary>
          {processedCitations.map((cit) => (
            <p key={cit.title}>
              {cit.citation_number} <a href={cit.document_url}>{cit.title}</a>
            </p>
          ))}
        </details>
      )}

      {isPending && <ThinkingIndicator />}
    </div>
  )
}

export default React.memo(MessageBubble)
