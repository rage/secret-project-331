import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { ReactElement, useEffect, useId, useMemo, useReducer, useRef, useState } from "react"
import { useHover } from "react-aria"
import { useTranslation } from "react-i18next"

import MyPopover from "./MyPopover"
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
}

interface HoverState {
  refElement: HTMLElement | null
  citationButtonClicked: boolean
}

type MessageAction =
  | { type: "UNFOCUS_POPPER_ELEMENT"; payload: EventTarget | null }
  | { type: "HOVER_CITATION_BUTTON"; payload: HTMLElement }
  | { type: "UNHOVER_CITATION_BUTTON"; payload: HTMLElement }
  | { type: "CLICK_CITATION_BUTTON"; payload: HTMLButtonElement | null }
  | { type: "DISMISS_MODAL_POPOVER" }

const popperStateReducer = (state: HoverState, action: MessageAction): HoverState => {
  switch (action.type) {
    case "HOVER_CITATION_BUTTON":
      if (action.payload === state.refElement) {
        return state
      }
      return { ...state, refElement: action.payload }
    case "UNHOVER_CITATION_BUTTON":
      console.log("UNHOVERED")

      return { ...state, refElement: null }
    case "CLICK_CITATION_BUTTON":
      console.log("CLICKED")
      if (state.citationButtonClicked && state.refElement == action.payload) {
        return { ...state, refElement: null, citationButtonClicked: false }
      }
      return { ...state, refElement: action.payload, citationButtonClicked: true }
    case "DISMISS_MODAL_POPOVER":
      return { ...state, citationButtonClicked: false, refElement: null }
    default:
      return state
  }
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
      [data-linklike] {
        color: ${baseTheme.colors.blue[700]}; /* TODO accessibility issue, not enough contrast?*/
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

  const [citationsOpen, setCitationsOpen] = useState(false)

  let triggerRef = useRef<HTMLElement>(null)

  const [hoverState, dispatch] = useReducer(popperStateReducer, {
    refElement: null,
    citationButtonClicked: false,
  })

  let { hoverProps: hoverCitationProps, isHovered: isCitationHovered } = useHover({
    onHoverStart: (e) => {
      console.log("hoverstart", e.target)
      dispatch({ type: "HOVER_CITATION_BUTTON", payload: e.target })
    },
    onHoverEnd: (e) => {
      console.log("hover end", e.target)
      triggerRef.current = null
      dispatch({ type: "UNHOVER_CITATION_BUTTON", payload: e.target })
    },
  })
  let { hoverProps: hoverPopoverProps, isHovered: isPopoverHovered } = useHover({
    onHoverStart: (e) => {
      console.log("hoverstart pop", e.target)
      //dispatch({ type: "HOVER_POPPER_ELEMENT", payload: e.target })
    },
    onHoverEnd: (e) => {
      console.log("hover end pop", e.target)
      triggerRef.current = null
      //dispatch({ type: "UNHOVER_POPPER_ELEMENT", payload: e.target })
    },
  })
  console.log(hoverState)

  useEffect(() => {
    triggerRef.current = hoverState.refElement
  }, [hoverState.refElement])

  const [processedMessage, processedCitations, citationTitleLen] = useMemo(() => {
    let renderedMessage: ReactElement[] = []
    let filteredCitations: ChatbotConversationMessageCitation[] = []

    if (isFromChatbot) {
      let messageCopy = message
      messageCopy = sanitizeCourseMaterialHtml(md.render(messageCopy).trim()).slice(3, -4)
      // slicing to remove the <p>-tags that envelope the whole message, since they will be broken
      // when the message is split into parts later
      let citedDocs = Array.from(messageCopy.matchAll(/\[[a-z]*?([0-9]+)\]/g), (arr, _) =>
        parseInt(arr[1]),
      )
      let citedDocsSet = new Set(citedDocs)
      filteredCitations = citations
        ? citations.filter((cit) => citedDocsSet.has(cit.citation_number))
        : []
      if (citationsOpen && filteredCitations.length > 0) {
        // if there are citations in text, render buttons for them & md
        let messageParts = messageCopy.split(/\[[a-z]*?[0-9]+\]/g)
        renderedMessage = messageParts.map((s, i) => {
          let cit_n = citedDocs[i]
          let citation = filteredCitations.find((c) => c.citation_number === cit_n)
          return (
            <span key={i} className={messageStyle(false)}>
              <span dangerouslySetInnerHTML={{ __html: s }}></span>
              {cit_n && citation && (
                <>
                  <button
                    id={`cit-${cit_n}-${i}`}
                    {...hoverCitationProps}
                    // @ts-expect-error: Ref missing from type definitions
                    ref={triggerRef}
                    onClick={(e) =>
                      dispatch({ type: "CLICK_CITATION_BUTTON", payload: e.currentTarget })
                    }
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
        messageCopy = messageCopy.replace(/\s\[[a-z]*?[0-9]+\]/g, "")
        renderedMessage = [
          <span
            key="1"
            className={messageStyle(false)}
            dangerouslySetInnerHTML={{ __html: messageCopy }}
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
    // represents the collapsed list width
    const citationTitleLen = 60 / filteredCitations.length

    return [renderedMessage, filteredCitations, citationTitleLen]
  }, [message, citations, isFromChatbot, citationsOpen, hoverCitationProps])

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
                      <span>
                        <b
                          className={css`
                            padding: 0 1em 0 0.25em;
                          `}
                        >
                          {cit.citation_number}
                        </b>
                        <span data-linklike={true}>
                          {cit.course_material_chapter_number &&
                            t("chapter-chapter-number", {
                              chapterNumber: cit.course_material_chapter_number,
                            })}
                          {`${cit.title}`}
                        </span>
                      </span>
                      <Library size={18} />
                    </a>
                  ) : (
                    <>
                      <b>{cit.citation_number}</b>{" "}
                      {cit.title.length <= citationTitleLen
                        ? cit.title
                        : cit.title.slice(0, citationTitleLen - 3).concat("...")}
                    </>
                  )}
                  <MyPopover
                    /* eslint-disable-next-line i18next/no-literal-string */
                    placement="top"
                    triggerRef={triggerRef}
                    isOpen={
                      isCitationHovered || isPopoverHovered || hoverState.citationButtonClicked
                    }
                    isNonModal={!hoverState.citationButtonClicked}
                    onOpenChange={() => {
                      console.log("closing")
                      dispatch({ type: "DISMISS_MODAL_POPOVER" })
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
                              chapterNumber: cit.course_material_chapter_number,
                            })}{" "}
                            {cit.title}
                          </b>
                        </span>
                      </a>
                      <Library size={18} />
                    </p>
                  </MyPopover>
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

export default React.memo(MessageBubble)
