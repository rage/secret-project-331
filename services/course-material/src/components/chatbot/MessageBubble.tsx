import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { ReactElement, useId, useMemo, useRef, useState } from "react"
import { useHover } from "react-aria"
import { useTranslation } from "react-i18next"

import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import SpeechBalloonPopover from "@/shared-module/common/components/SpeechBalloonPopover"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"
import { getRemarkable } from "@/utils/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

interface MessageBubbleProps {
  message: string
  isFromChatbot: boolean
  isPending: boolean
  citations: ChatbotConversationMessageCitation[] | undefined
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
  font-size: 90%;
  a {
    display: flex;
    flex-flow: row nowrap;
    justify-content: space-between;
    gap: 1em;
    color: #000000;
    text-decoration: none;
  }
  a {
    &:hover {
      .linklike {
        color: ${baseTheme.colors.blue[700]};
        text-decoration: underline;
      }
    }
  }
`

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
  white-space: pre-wrap;
`
const expandButtonStyle = css`
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
`

const referenceListStyle = (expanded: boolean, referenceList: string) => css`
  display: flex;
  ${expanded ? `flex-flow: column nowrap;` : `flex-flow: row nowrap;`}

  #${referenceList} {
    display: flex;
    flex: 10;
    ${expanded
      ? `
    flex-flow: column nowrap;
    padding: 7px;
    justify-content: space-around;
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
}) => {
  const { t } = useTranslation()

  const referenceListId = useId()

  // the ref is updated manually because there are multiple trigger elements for the popover
  // that are "activated" by clicking or hovering them
  let triggerRef = useRef<HTMLButtonElement>(null)

  const [citationsOpen, setCitationsOpen] = useState(false)
  const [citationButtonClicked, setCitationButtonClicked] = useState(false)

  let { hoverProps: hoverCitationProps, isHovered: isCitationHovered } = useHover({
    onHoverStart: (e) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        throw new Error("This hover is meant to be used on buttons only.")
      }
      triggerRef.current = e.target
    },
    onHoverEnd: (e) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        throw new Error("This hover is meant to be used on buttons only.")
      }
      if (!citationButtonClicked) {
        triggerRef.current = null
      }
    },
  })
  let { hoverProps: hoverPopoverProps, isHovered: isPopoverHovered } = useHover({})

  const [processedMessage, processedCitations, citationTitleLen] = useMemo(() => {
    let renderedMessage: ReactElement[] = []
    let filteredCitations: ChatbotConversationMessageCitation[] = []

    if (isFromChatbot) {
      let messageCopy = message
      messageCopy = md.render(messageCopy).trim().slice(3, -4)
      // slicing to remove the <p>-tags that envelope the whole message, since they will be broken
      // when the message is split into parts later
      let citedDocs = Array.from(messageCopy.matchAll(/\[[\w]*?([\d]+)\]/g), (arr, _) =>
        parseInt(arr[1]),
      )
      let citedDocsSet = new Set(citedDocs)
      filteredCitations = citations
        ? citations.filter((cit) => citedDocsSet.has(cit.citation_number))
        : []
      if (citationsOpen && filteredCitations.length > 0) {
        // if there are citations in text, render buttons for them & md
        let messageParts = messageCopy.split(/\[[\w]*?[\d]+\]/g)
        renderedMessage = messageParts.map((s, i) => {
          let cit_n = citedDocs[i]
          let citation = filteredCitations.find((c) => c.citation_number === cit_n)
          return (
            <span
              key={i}
              className={messageStyle(
                citationButtonClicked && triggerRef.current?.id === `cit-${cit_n}-${i}`,
              )}
            >
              <span dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(s) }}></span>
              {cit_n && citation && (
                <>
                  <button
                    id={`cit-${cit_n}-${i}`}
                    {...hoverCitationProps}
                    onClick={(e) => {
                      setCitationButtonClicked(true)
                      triggerRef.current = e.currentTarget
                    }}
                  >
                    {cit_n}
                  </button>
                </>
              )}
            </span>
          )
        })
      } else {
        // render only md
        messageCopy = messageCopy.replace(/\s\[[\w]*?[\d]+\]/g, "")
        renderedMessage = [
          <span
            key="1"
            className={messageStyle(false)}
            dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(messageCopy) }}
          ></span>,
        ]
      }
    } else {
      // user message with no md rendering
      renderedMessage = [
        <span key="1" className={messageStyle(false)}>
          {message}
        </span>,
      ]
    }
    // 60 represents the n of chars in the collapsed list width, allocate it
    // for the citations by dividing by n of citations
    const citationTitleLen = 60 / filteredCitations.length

    return [renderedMessage, filteredCitations, citationTitleLen]
  }, [message, citations, isFromChatbot, citationsOpen, hoverCitationProps, citationButtonClicked])

  return (
    <div className={bubbleStyle(isFromChatbot)}>
      {processedMessage}

      {isFromChatbot && processedCitations.length > 0 && (
        <div
          className={css`
            margin-top: 15px;
            hr {
              opacity: 40%;
            }
          `}
        >
          <hr></hr>
          <h4>{t("references")}</h4>
          <div className={referenceListStyle(citationsOpen, referenceListId)}>
            <div id={referenceListId}>
              {processedCitations.map((cit) => (
                <div key={cit.id} className={citationStyle}>
                  {citationsOpen ? (
                    <a href={cit.document_url}>
                      <span
                        className={css`
                          flex: 7;
                        `}
                      >
                        <b
                          className={css`
                            padding: 0 1em 0 0.25em;
                          `}
                        >
                          {cit.citation_number}
                        </b>
                        <span className="linklike">
                          {cit.course_material_chapter_number &&
                            t("chapter-chapter-number", {
                              number: cit.course_material_chapter_number,
                            })}
                          {`: ${cit.title}`}
                        </span>
                      </span>
                      <Library
                        className={css`
                          flex: 1;
                          padding: 2px;
                          margin-right: -5px;
                          align-self: flex-end;
                        `}
                      />
                    </a>
                  ) : (
                    <>
                      <b>{cit.citation_number}</b>{" "}
                      {cit.title.length <= citationTitleLen
                        ? cit.title
                        : cit.title.slice(0, citationTitleLen - 3).concat("...")}
                    </>
                  )}
                  <SpeechBalloonPopover
                    placement="top"
                    triggerRef={triggerRef}
                    isOpen={isCitationHovered || isPopoverHovered || citationButtonClicked}
                    isNonModal={!citationButtonClicked}
                    onOpenChange={() => {
                      setCitationButtonClicked(false)
                    }}
                    popoverLabel={`${t("citation")} ${cit.citation_number}`}
                    {...hoverPopoverProps}
                  >
                    <p
                      className={css`
                        overflow-wrap: break-word;
                        height: 6lh;
                        margin-bottom: 0.5em;
                        mask-image: linear-gradient(0.5turn, black 66%, transparent);
                      `}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeCourseMaterialHtml(md.render(cit.content).trim()),
                      }}
                    ></p>
                    <p
                      className={css`
                        display: flex;
                        justify-content: space-between;
                        flex-flow: row nowrap;
                        position: relative;
                        gap: 10px;

                        a::after {
                          content: "";
                          position: absolute;
                          top: 0;
                          left: 0;
                          width: 100%;
                          height: 100%;
                        }
                      `}
                    >
                      <a href={cit.document_url}>
                        <span>
                          <b>
                            {t("chapter-chapter-number", {
                              number: cit.course_material_chapter_number,
                            })}
                            {`: ${cit.title}`}
                          </b>
                        </span>
                      </a>
                      <Library
                        className={css`
                          align-self: flex-end;
                          width: 3em;
                          margin-right: -5px;
                        `}
                      />
                    </p>
                  </SpeechBalloonPopover>
                </div>
              ))}
            </div>

            <button
              aria-controls={referenceListId}
              onClick={() => {
                setCitationsOpen(!citationsOpen)
              }}
              aria-label={t("show-references")}
              aria-expanded={citationsOpen}
              className={expandButtonStyle}
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

export default MessageBubble
