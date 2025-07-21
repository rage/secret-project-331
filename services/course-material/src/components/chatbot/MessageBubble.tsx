import { css } from "@emotion/css"
import { UpArrow } from "@vectopus/atlas-icons-react"
import React, { useMemo, useState } from "react"

import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import DownIcon from "@/shared-module/common/img/down.svg"
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
    cursor: pointer;
  }
  ${showCitations
    ? `
      details {
        padding: 2px 6px;
        margin-bottom: 1em;
      }
      details:first-of-type summary::marker,
      :is(::-webkit-details-marker) {
        content: "";
        padding: 50px;
        margin-inline-start: 50px;
        font-family: monospace;
        font-weight: bold;
      }
      details[open]:first-of-type summary::marker {
        content: "";
      }
      details:last-of-type summary::-webkit-details-marker {
        display: none;
      }

    `
    : ``}
`

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
  span {
    background-color: ${baseTheme.colors.gray[200]};
    padding: 2px 7px 2px 7px;
    border-radius: 10px;
    font-size: 85%;
  }

  white-space: pre-wrap;
`

const referenceListStyleOpen = css`
  display: flex;
  flex-flow: column nowrap;
  padding: 7px;
  border-radius: 10px;
`
const referenceListStyleClosed = css`
  display: flex;
  flex-flow: row nowrap;
  overflow: hidden;
  white-space: pre;
  padding: 0 0 0 0;
  border-radius: 10px;
  mask-image: linear-gradient(0.25turn, black 66%, transparent);
`

const referenceStyle = css`
  margin: 4px 4px 4px 0;
  border-radius: 10px;
  background-color: ${baseTheme.colors.gray[200]};
  padding: 2px 7px 2px 7px;
  border-radius: 10px;
  font-size: 85%;
`

let md = getRemarkable()

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFromChatbot,
  isPending,
  citations,
  hideCitations,
}) => {
  let [openCitations, setOpenCitations] = useState(false)

  const [processedMessage, processedCitations] = useMemo(() => {
    let renderedMessage = message
    renderedMessage = sanitizeCourseMaterialHtml(md.render(renderedMessage).trim())
    let filteredCitations: ChatbotConversationMessageCitation[] = []

    if (isFromChatbot) {
      if (citations && hideCitations) {
        renderedMessage = renderedMessage.replace(/\s\[[a-z]*?[0-9]+\]/g, "")
      } else if (citations) {
        let citedDocs = new Set(
          Array.from(renderedMessage.matchAll(/\[[a-z]*?([0-9]+)\]/g), (arr, _) =>
            parseInt(arr[1]),
          ),
        )
        if (openCitations) {
          /* eslint-disable i18next/no-literal-string */
          renderedMessage = renderedMessage.replace(/\[[a-z]*?([0-9]+)\]/g, `<span>$1</span>`)
        } else {
          renderedMessage = renderedMessage.replace(/\s\[[a-z]*?[0-9]+\]/g, "")
        }
        // TODO is it bad to do two regex operations?
        //console.log("citedDocs: ", citedDocs)

        filteredCitations = citations //.filter((cit) => citedDocs.has(cit.citation_number))
      }
    }
    return [renderedMessage, filteredCitations]
  }, [hideCitations, message, citations, isFromChatbot, openCitations])
  return (
    <div className={bubbleStyle(isFromChatbot, !hideCitations && processedCitations.length > 0)}>
      {!isFromChatbot && (
        <span
          className={messageStyle}
          dangerouslySetInnerHTML={{ __html: processedMessage }}
        ></span>
      )}
      <span className={messageStyle} dangerouslySetInnerHTML={{ __html: processedMessage }}></span>
      {isFromChatbot && citations && (
        <details
          onToggle={() => {
            setOpenCitations(!openCitations)
          }}
        >
          <summary>References</summary>
          {
            // TODO to screenreaders this is a button so it might not be a good idea
            // to but links/buttons inside of it
          }
          <div className={openCitations ? referenceListStyleOpen : referenceListStyleClosed}>
            {processedCitations.map((cit) => (
              <p key={cit.citation_number} className={referenceStyle}>
                {openCitations ? (
                  <p>
                    <span>{cit.citation_number}</span> <a href={cit.document_url}>{cit.title}</a>
                  </p>
                ) : (
                  <p>
                    <span>{cit.citation_number}</span> {cit.title.slice(0, 15)}...
                  </p>
                )}
              </p>
            ))}
          </div>
          {openCitations ? <UpArrow /> : <DownIcon />}
        </details>
      )}
      {!openCitations && (
        <div className={openCitations ? referenceListStyleOpen : referenceListStyleClosed}>
          {processedCitations.map((cit) => (
            <p key={cit.citation_number} className={referenceStyle}>
              {openCitations ? (
                <p>
                  <span>{cit.citation_number}</span> <a href={cit.document_url}>{cit.title}</a>
                </p>
              ) : (
                <p>
                  <span>{cit.citation_number}</span> {cit.title.slice(0, 15)}...
                </p>
              )}
            </p>
          ))}
        </div>
      )}
      {isPending && <ThinkingIndicator />}
    </div>
  )
}

export default React.memo(MessageBubble)
