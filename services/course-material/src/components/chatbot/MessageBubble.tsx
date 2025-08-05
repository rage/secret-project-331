import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { ReactElement, useEffect, useId, useMemo, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import CitationPopover from "./CitationPopover"
import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import useClickOutside from "@/shared-module/common/hooks/useClickOutside"
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

interface PopperState {
  citationButton: HTMLButtonElement | null
  hoveringCitationButton: boolean
  hoveringPopperElement: boolean
  citationButtonClicked: boolean
}

type MessageAction =
  | { type: "HOVER_POPPER_ELEMENT" }
  | { type: "UNHOVER_POPPER_ELEMENT" }
  | { type: "UNFOCUS_POPPER_ELEMENT"; payload: EventTarget | null }
  | { type: "HOVER_CITATION_BUTTON"; payload: HTMLButtonElement }
  | { type: "UNHOVER_CITATION_BUTTON" }
  | { type: "CLICK_CITATION_BUTTON"; payload: HTMLButtonElement | null }
  | { type: "ESCAPE_POPPER_ELEMENT" }

const popStateReducer = (state: PopperState, action: MessageAction): PopperState => {
  switch (action.type) {
    case "HOVER_POPPER_ELEMENT": {
      return { ...state, hoveringPopperElement: true }
    }
    case "UNHOVER_POPPER_ELEMENT": {
      return { ...state, hoveringPopperElement: false }
    }
    case "UNFOCUS_POPPER_ELEMENT":
      console.log("UNFOCUS POP")
      if (action.payload === state.citationButton) {
        return state
      }
      if (
        state.citationButtonClicked === true &&
        state.hoveringPopperElement === false &&
        state.hoveringCitationButton === false
      ) {
        state.citationButton?.focus()
        return {
          ...state,
          citationButtonClicked: false,
          citationButton: null,
        }
      }
      return state
    case "HOVER_CITATION_BUTTON":
      return { ...state, hoveringCitationButton: true, citationButton: action.payload }
    case "UNHOVER_CITATION_BUTTON":
      return { ...state, hoveringCitationButton: false }
    case "CLICK_CITATION_BUTTON":
      console.log("CLICK")
      return {
        ...state,
        citationButton: action.payload,
        citationButtonClicked: !state.citationButtonClicked,
      }
    case "ESCAPE_POPPER_ELEMENT":
      console.log("ESCSPE")
      return { ...state, citationButtonClicked: false }
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

  const popperElementId = useId()
  const popperElementLinkId = useId()
  const referenceListId = useId()

  const [citationsOpen, setCitationsOpen] = useState(false)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = React.useState<HTMLElement | null>(null)
  const outSideClickRef = useRef<HTMLDivElement>(null)

  const [showPopover, setShowPopover] = useState<boolean>(false)
  const [popState, dispatch] = useReducer(popStateReducer, {
    citationButton: null,
    hoveringCitationButton: false,
    hoveringPopperElement: false,
    citationButtonClicked: false,
  })

  console.log(popState)

  useClickOutside(
    outSideClickRef,
    (e) => dispatch({ type: "UNFOCUS_POPPER_ELEMENT", payload: e.target }),
    showPopover,
  )

  const { styles, attributes } = usePopper(popState.citationButton, popperElement, {
    placement: "top",
    modifiers: [
      {
        name: "preventOverflow",
        options: {
          padding: 8,
          boundary: "clippingParents",
          altAxis: true,
        },
      },
      {
        name: "computeStyles",
        options: {
          gpuAcceleration: false,
        },
      },
      {
        name: "eventListeners",
        options: {
          scroll: true,
          resize: true,
        },
      },
      { name: "arrow", options: { element: arrowElement } },
    ],
    strategy: "absolute",
  })

  useEffect(() => {
    console.log("inside effect")
    let timeoutId: NodeJS.Timeout | null = null

    if (
      popState.citationButtonClicked ||
      popState.hoveringCitationButton ||
      popState.hoveringPopperElement
    ) {
      timeoutId = setTimeout(() => {
        setShowPopover(true)
      }, 200)
    } else {
      setShowPopover(false)
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [popState])

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
      if (filteredCitations.length > 0 && citationsOpen) {
        // if there are citations in text, render buttons for them & md
        let messageParts = messageCopy.split(/\[[a-z]*?[0-9]+\]/g)
        renderedMessage = messageParts.map((s, i) => {
          return (
            <span
              key={i}
              className={messageStyle(
                popState.citationButton?.id === `cit-${citedDocs[i]}-${i}` &&
                  popState.citationButtonClicked,
              )}
            >
              <span dangerouslySetInnerHTML={{ __html: s }}></span>
              {citedDocs[i] && (
                <>
                  <button
                    id={`cit-${citedDocs[i]}-${i}`}
                    value={citedDocs[i]}
                    onClick={(e) => {
                      console.log("clicked")
                      dispatch({ type: "CLICK_CITATION_BUTTON", payload: e.currentTarget })
                      setTimeout(() => {
                        document.getElementById(popperElementLinkId)?.focus()
                      }, 300)
                    }}
                    onMouseEnter={(e) => {
                      dispatch({ type: "HOVER_CITATION_BUTTON", payload: e.currentTarget })
                    }}
                    onMouseLeave={() => {
                      dispatch({ type: "UNHOVER_CITATION_BUTTON" })
                    }}
                  >
                    {citedDocs[i]}
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
    // 60 is magick number that represents the collapsed list width
    const citationTitleLen = 60 / filteredCitations.length

    return [renderedMessage, filteredCitations, citationTitleLen]
  }, [
    message,
    citations,
    isFromChatbot,
    citationsOpen,
    popperElementLinkId,
    popState.citationButton,
    popState.citationButtonClicked,
  ])

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
                  {popState.citationButton?.id.includes(`cit-${cit.citation_number}`) &&
                    showPopover && (
                      <div ref={outSideClickRef}>
                        <CitationPopover
                          id={popperElementId}
                          linkId={popperElementLinkId}
                          setPopperElement={setPopperElement}
                          setHoverPopperElement={(b) => {
                            if (b === true) {
                              dispatch({ type: "HOVER_POPPER_ELEMENT" })
                            } else {
                              dispatch({ type: "UNHOVER_POPPER_ELEMENT" })
                            }
                          }}
                          setArrowElement={setArrowElement}
                          escape={() => {
                            dispatch({ type: "ESCAPE_POPPER_ELEMENT" })
                            popState.citationButton?.focus()
                          }}
                          citation={cit}
                          content={sanitizeCourseMaterialHtml(md.render(cit.content).trim())}
                          popperStyles={styles}
                          popperAttributes={attributes}
                        />
                      </div>
                    )}
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
