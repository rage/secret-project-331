import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

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
}

const tooltipStyle = css`
  z-index: 100;
  padding: 5px;
  animation: fadeIn 0.2s ease-in-out;
  pointer-events: auto;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`

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
    &:hover {
      span {
        color: ${baseTheme.colors.blue[700]}; /*accessibility issue, not enough contrast?*/
        text-decoration: underline;
      }
    }
  }
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
    }
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
  let [citationsOpen, setCitationsOpen] = useState(false)

  const [referenceElement, setReferenceElement] = React.useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = React.useState<HTMLElement | null>(null)
  const [hoverPopperElement, setHoverPopperElement] = React.useState<boolean>(false)
  const [hoverRefElement, setHoverRefElement] = React.useState<boolean>(false)

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
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
    ],
    strategy: "absolute",
  })
  useEffect(() => {
    if (!hoverRefElement) {
      if (!hoverPopperElement) {
        setReferenceElement(null)
      }
    }
  }, [hoverPopperElement, hoverRefElement])

  const handleRefElemHover = (elem: HTMLButtonElement | null) => {
    if (!(elem === null)) {
      setHoverRefElement(true)
      setReferenceElement(elem)
    } else {
      setHoverRefElement(false)
    }
  }
  const handleRefElemClick = useCallback(
    (elem: HTMLButtonElement | null) => {
      // toggle if elem is provided, if elem is null then "unclick"
      // TODO idk how to optimize this so that the useMemo is actually useful.
      // now useMemo is recomputed whenever the popover is toggled open or even hovered
      // so that must be inefficient?
      if (elem === null && hoverPopperElement) {
        return
      } else if (!(elem === null)) {
        setReferenceElement(referenceElement === null ? elem : null)
      } else {
        setReferenceElement(null)
      }
    },
    [referenceElement, hoverPopperElement],
  )

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
      filteredCitations = citations ? citations : [] //.filter((cit) => citedDocsSet.has(cit.citation_number))
      if (filteredCitations.length > 0 && citationsOpen) {
        // if there are citations in text, render buttons for them & md
        let messageParts = messageCopy.split(/\[[a-z]*?[0-9]+\]/g)
        renderedMessage = messageParts.map((s, i) => {
          return (
            <span key={i} className={messageStyle}>
              <span dangerouslySetInnerHTML={{ __html: s }}></span>
              {citedDocs[i] && (
                <>
                  <button
                    id={`cit-${citedDocs[i]}`}
                    value={citedDocs[i]}
                    //{...attributes.popper}
                    onClick={(e) => {
                      handleRefElemClick(e.currentTarget)
                    }}
                    onMouseEnter={(e) => {
                      handleRefElemHover(e.currentTarget)
                    }}
                    onMouseLeave={() => {
                      handleRefElemHover(null)
                    }}
                    onBlur={(e) => {
                      if (e.relatedTarget?.id === "popover-button") {
                        return
                      }
                      handleRefElemClick(null)
                    }}
                    //aria-label={`Citation ${citedDocs[i]}`}
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
            className={messageStyle}
            dangerouslySetInnerHTML={{ __html: messageCopy }}
          ></span>,
        ]
      }
    } else {
      // user message with no md rendering
      renderedMessage = [
        <span key="1" className={messageStyle}>
          {message}
        </span>,
      ]
    }
    // 60 is magick number that represents the collapsed list width
    const citationTitleLen = 60 / filteredCitations.length

    return [renderedMessage, filteredCitations, citationTitleLen]
  }, [message, citations, isFromChatbot, citationsOpen, handleRefElemClick])

  return (
    <div className={bubbleStyle(isFromChatbot)}>
      {processedMessage}

      {isFromChatbot && processedCitations.length > 0 && (
        <div className={referenceListStyle(citationsOpen)}>
          <hr></hr>
          <h4>{t("references")}</h4>
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
                    </div>
                  ) : (
                    <>
                      <b>{cit.citation_number}</b>{" "}
                      {cit.title.length <= citationTitleLen
                        ? cit.title
                        : cit.title.slice(0, citationTitleLen - 3).concat("...")}
                    </>
                  )}
                  {referenceElement?.id == `cit-${cit.citation_number}` && (
                    <div
                      id="popover"
                      ref={setPopperElement}
                      className={tooltipStyle}
                      /* eslint-disable-next-line react/forbid-dom-props */
                      style={styles.popper}
                      onMouseEnter={() => {
                        setHoverPopperElement(true)
                      }}
                      onMouseLeave={() => {
                        setHoverPopperElement(false)
                      }}
                      onBlur={(e) => {
                        if (e.relatedTarget?.id === `cit-${cit.citation_number}`) {
                          return
                        }
                        setReferenceElement(null)
                      }}
                      {...attributes.popper}
                    >
                      <SpeechBalloon>
                        {" "}
                        <button
                          id="popover-button"
                          onClick={() => {
                            console.log("clicked pop")
                          }}
                        >
                          {cit.title}
                        </button>
                      </SpeechBalloon>
                    </div>
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
