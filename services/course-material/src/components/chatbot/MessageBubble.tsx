import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { ReactElement, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

//import { tooltipStyles } from "../ContentRenderer/core/formatting/CodeBlock/styles"

import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import SpeechBalloon from "@/shared-module/common/components/SpeechBalloon"
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
const citationStyle = css`
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
  button {
    /*Citations are inside span(/button????) tags, it's assumed span tags wouldn't
    be used otherwise */
    &:hover {
      filter: brightness(0.9) contrast(1.1);
    }
    border: none;
    cursor: default;
    background-color: ${baseTheme.colors.gray[200]};
    padding: 0 7px 0 7px;
    border-radius: 10px;
    font-size: 85%;
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
  a {
    display: flex;
    flex-flow: row nowrap;
    gap: 1em;
    color: #000000;
    text-decoration: none;
    &:hover {
      color: blue;
      text-decoration: underline;
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
    div[popover] {
      border: none;
      position: absolute;
      inset-inline-start: 40px;
      inset-block-start: 40px;
    }
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
  let [citationsOpen, setCitationsOpen] = useState(false)
  let [showLinkPreview, setShowLinkPreview] = useState(false)

  const [processedMessage, processedCitations, citationTitleLen, citationButtons] = useMemo(() => {
    let messageCopy = message
    messageCopy = sanitizeCourseMaterialHtml(md.render(messageCopy).trim())
    let renderedMessage: string[] = []
    let filteredCitations: ChatbotConversationMessageCitation[] = []
    let citationButtons: ReactElement[] = []

    if (isFromChatbot) {
      if (citations && hideCitations) {
        renderedMessage = [messageCopy.replace(/\s\[[a-z]*?[0-9]+\]/g, "")]
      } else if (citations) {
        let citedDocs = Array.from(messageCopy.matchAll(/\[[a-z]*?([0-9]+)\]/g), (arr, _) =>
          parseInt(arr[1]),
        )

        let citedDocsSet = new Set(citedDocs)
        if (citationsOpen) {
          /* eslint-disable i18next/no-literal-string */
          renderedMessage = messageCopy.split(/\[[a-z]*?[0-9]+\]/g)
          citationButtons = citedDocs.map((cit) => {
            return (
              <button
                id={`cit-${cit}`}
                key={cit}
                popoverTarget={`popover-${cit}`}
                onMouseEnter={() => console.log("hovered cit ", cit)}
                onMouseLeave={() => {}}
              >
                {cit}
              </button>
            )
          })
          /* renderedMessage = renderedMessage.replace(
            /\[[a-z]*?([0-9]+)\]/g,
            `<button popovertarget="popover-$1">$1</button>`,
          ) */ // split the string at citations and render in alternating parts as innerhtml and buttons?
        } else {
          renderedMessage = [messageCopy.replace(/\s\[[a-z]*?[0-9]+\]/g, "")]
        }
        // TODO is it bad to do two regex operations?
        filteredCitations = citations //.filter((cit) => citedDocsSet.has(cit.citation_number))
      }
    } else {
      renderedMessage = [messageCopy]
    }
    // 60 is magick number that represents the collapsed list width
    const citationTitleLen = 60 / filteredCitations.length

    return [renderedMessage, filteredCitations, citationTitleLen, citationButtons]
  }, [hideCitations, message, citations, isFromChatbot, citationsOpen])

  return (
    <div className={bubbleStyle(isFromChatbot)}>
      {processedMessage.map((s, idx) => (
        <span key={idx} className={messageStyle}>
          <span dangerouslySetInnerHTML={{ __html: s }}></span>
          {citationButtons[idx]}
        </span>
      ))}

      {isFromChatbot && !hideCitations && processedCitations.length > 0 && (
        <div className={referenceListStyle(citationsOpen)}>
          <hr></hr>
          <h4>References</h4>
          <div id="container">
            <div id="referenceList">
              {processedCitations.map((cit) => (
                <div key={cit.citation_number} className={citationStyle}>
                  {citationsOpen ? (
                    <div>
                      <a href={cit.document_url}>
                        <b>{cit.citation_number}</b>
                        <span
                          className={css`
                            flex: 3;
                          `}
                        >
                          {cit.course_material_chapter !== cit.title
                            ? `${cit.course_material_chapter}: `
                            : ""}
                          {`${cit.title}`}
                        </span>
                        <Library size={18} />
                      </a>{" "}
                      <div popover="auto" id={`popover-${cit.citation_number}`}>
                        <SpeechBalloon>Hello {cit.title}</SpeechBalloon>
                      </div>
                    </div>
                  ) : (
                    <>
                      <b>{cit.citation_number}</b>{" "}
                      {cit.title.length <= citationTitleLen
                        ? cit.title
                        : cit.title.slice(0, citationTitleLen - 3).concat("...")}
                    </>
                  )}
                </div>
              ))}
            </div>
            <button
              id="expandButton"
              aria-controls="referenceList"
              onClick={() => {
                // TODO use a checkbox instead of custom element?
                setCitationsOpen(!citationsOpen)
              }}
              aria-label={t("show-references")}
              aria-expanded={citationsOpen}
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
