import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

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

const bubbleStyle = (isFromChatbot: boolean) => css`
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
`
const referenceStyle = css`
  margin: 4px 4px 4px 0;
  background-color: ${baseTheme.colors.gray[200]};
  padding: 2px 7px 2px 7px;
  border-radius: 10px;
  font-size: 85%;
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
    /*Citations are inside span tags, it's assumed span tags wouldn't
    be used otherwise */
    ${referenceStyle}
  }
  white-space: pre-wrap;
`

const referenceListStyle = (expanded: boolean) => css`
  margin-top: 15px;
  hr {
    opacity: 40%;
  }
  button[aria-expanded] {
    flex: 1;
    cursor: pointer;
    background-color: ${baseTheme.colors.gray[100]};
    border: none;
    margin: 0 0.5rem;
    color: ${baseTheme.colors.gray[400]};
    transition: filter 0.2s;

    &:hover {
      filter: brightness(0.9) contrast(1.1);
    }
  }
  #container {
    display: flex;
    ${expanded ? `flex-flow: column nowrap;` : `flex-flow: row nowrap;`}
  }
  #referenceList {
    display: flex;
    ${expanded
      ? `
    flex-flow: column nowrap;
    padding: 7px;
    `
      : `
    flex-flow: row nowrap;
    overflow: hidden;
    white-space: pre;
    mask-image: linear-gradient(0.25turn, black 66%, transparent);
  `}
  }
`

let md = getRemarkable()

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFromChatbot,
  isPending,
  citations,
  hideCitations,
}) => {
  const { t } = useTranslation()
  let [citationsOpen, setcitationsOpen] = useState(false)

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
        if (citationsOpen) {
          /* eslint-disable i18next/no-literal-string */
          renderedMessage = renderedMessage.replace(/\[[a-z]*?([0-9]+)\]/g, `<span>$1</span>`)
        } else {
          renderedMessage = renderedMessage.replace(/\s\[[a-z]*?[0-9]+\]/g, "")
        }
        // TODO is it bad to do two regex operations?
        filteredCitations = citations //.filter((cit) => citedDocs.has(cit.citation_number))
      }
    }
    return [renderedMessage, filteredCitations]
  }, [hideCitations, message, citations, isFromChatbot, citationsOpen])

  return (
    <div className={bubbleStyle(isFromChatbot)}>
      <span className={messageStyle} dangerouslySetInnerHTML={{ __html: processedMessage }}></span>
      {isFromChatbot && !hideCitations && processedCitations.length > 0 && (
        <div className={referenceListStyle(citationsOpen)}>
          <hr></hr>
          <h4>References</h4>
          <div id="container">
            <div id="referenceList">
              {processedCitations.map((cit) => (
                <p key={cit.citation_number} className={referenceStyle}>
                  {citationsOpen ? (
                    <>
                      <span>{cit.citation_number}</span> <a href={cit.document_url}>{cit.title}</a>{" "}
                      <Library size={18} />
                    </>
                  ) : (
                    <>
                      <span>{cit.citation_number}</span>{" "}
                      {cit.title.length <= 15 ? cit.title : cit.title.slice(0, 12).concat("...")}
                    </>
                  )}
                </p>
              ))}
            </div>
            <button
              id="expandButton"
              aria-controls="referenceList"
              onClick={() => {
                // TODO should focus on the expanded material?
                // TODO use a checkbox instead of custom element?
                setcitationsOpen(!citationsOpen)
              }}
              aria-label={t("show-references")}
              aria-expanded={citationsOpen ? "true" : "false"}
            >
              {citationsOpen ? <DownIcon transform="rotate(180)" /> : <DownIcon />}
            </button>
          </div>
        </div>
      )}

      {isPending && <ThinkingIndicator />}
    </div>
  )
}

export default React.memo(MessageBubble)
