import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useEffect, useId, useMemo, useRef, useState } from "react"
import { useHover } from "react-aria"
import { OverlayTriggerStateContext } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { LIGHT_GREEN } from "../shared/styles"

import { citationId } from "./CitationButton"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import SpeechBalloonPopover from "@/shared-module/common/components/SpeechBalloonPopover"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { getRemarkable } from "@/utils/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

let md = getRemarkable()

const referenceStyle = css`
  margin: 4px 4px 4px 0;
  background-color: ${baseTheme.colors.green[200]};
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
      .link {
        color: ${baseTheme.colors.blue[700]};
        text-decoration: underline;
      }
    }
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

const expandButtonStyle = css`
  flex: 1;
  cursor: pointer;
  background-color: ${LIGHT_GREEN};
  border: none;
  margin: 0 0.5rem;
  color: ${baseTheme.colors.green[400]};
  transition: filter 0.2s;

  &:hover {
    filter: brightness(0.9) contrast(1.1);
  }
`

interface ChatbotReferenceListProps {
  citations: ChatbotConversationMessageCitation[]
  citationNumberingMap: Map<number, number>
  triggerRef: React.RefObject<HTMLButtonElement | null>
  triggerRefId: string
  setTriggerRefId: (value: React.SetStateAction<string>) => void
  citationsOpen: boolean
  citationButtonClicked: boolean
  isCitationHovered: boolean
  setCitationButtonClicked: (value: React.SetStateAction<boolean>) => void
  setCitationsOpen: (value: React.SetStateAction<boolean>) => void
}

const ChatbotReferenceList: React.FC<ChatbotReferenceListProps> = ({
  citations,
  citationNumberingMap,
  triggerRef,
  triggerRefId,
  setTriggerRefId,
  citationsOpen,
  citationButtonClicked,
  isCitationHovered,
  setCitationButtonClicked,
  setCitationsOpen,
}) => {
  const referenceListId = useId()
  const popoverRef = useRef<HTMLElement>(null)
  const { t } = useTranslation()

  let { hoverProps: hoverPopoverProps, isHovered: isPopoverHovered } = useHover({})
  let [isPopoverOpen, setIsPopoverOpen] = useState(false)

  let citationsToList = useMemo(() => {
    let citationFilteringSet = new Set()
    return citations
      .filter((cit) => {
        if (citationFilteringSet.has(cit.document_url)) {
          return false
        } else {
          citationFilteringSet.add(cit.document_url)
          return true
        }
      })
      .map((cit) => cit.id)
  }, [citations])

  useEffect(() => {
    let open = isCitationHovered || isPopoverHovered || citationButtonClicked
    setIsPopoverOpen(open)
  }, [citationButtonClicked, isCitationHovered, isPopoverHovered, triggerRefId])

  useEffect(() => {
    const removeListenersAbortController = new AbortController()
    const currentRef = popoverRef.current
    currentRef?.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsPopoverOpen(false)
          setCitationButtonClicked(false)
          triggerRef.current = null
          setTriggerRefId("")
        }
      },
      { signal: removeListenersAbortController.signal },
    )

    return () => {
      removeListenersAbortController.abort()
    }
  }, [
    popoverRef,
    isPopoverOpen,
    citationButtonClicked,
    triggerRef,
    setTriggerRefId,
    setCitationButtonClicked,
  ])

  // 60 represents the n of chars in the collapsed reference list width, allocate it
  // evenly for the citations by dividing by n of citations
  const citationTitleLen = 60 / citationsToList.length

  return (
    <>
      <h2
        className={css`
          font-size: 135%;
        `}
      >
        {t("references")}
      </h2>
      <div className={referenceListStyle(citationsOpen, referenceListId)}>
        <div id={referenceListId}>
          {citations.map((cit) => {
            let citationNumber = assertNotNullOrUndefined(
              citationNumberingMap.get(cit.citation_number),
            )
            let citationTitle = cit.course_material_chapter_number
              ? `${t("chapter-chapter-number", {
                  number: cit.course_material_chapter_number,
                })}: `
              : ""
            citationTitle += cit.title

            return (
              <div key={cit.id}>
                {citationsToList.includes(cit.id) && (
                  <div className={referenceStyle}>
                    {citationsOpen ? (
                      <Link href={cit.document_url}>
                        <span
                          className={css`
                            flex: 7;
                            color: #000000;
                          `}
                        >
                          <b
                            className={css`
                              padding: 0 1em 0 0.25em;
                            `}
                          >
                            {citationNumber}
                          </b>
                          <span className="link">
                            {cit.course_material_chapter_number &&
                              `${t("chapter-chapter-number", {
                                number: cit.course_material_chapter_number,
                              })}: `}
                            {cit.title}
                          </span>
                        </span>
                        <Library
                          className={css`
                            flex: 1;
                            padding: 2px;
                            margin-right: -1em;
                            align-self: flex-end;
                            color: #000000;
                          `}
                        />
                      </Link>
                    ) : (
                      <>
                        <b>{citationNumber}</b>{" "}
                        {cit.title.length <= citationTitleLen
                          ? citationTitle
                          : // eslint-disable-next-line i18next/no-literal-string
                            citationTitle.slice(0, citationTitleLen - 3).concat("\u2026")}
                      </>
                    )}
                  </div>
                )}
                <OverlayTriggerStateContext.Provider
                  // this provider prevents the DialogTrigger higher in the DOM from
                  // controlling the dialog inside SpeechBalloonPopover
                  value={{
                    isOpen: false,
                    setOpen: () => {
                      //NOP
                    },
                    open: () => {
                      //NOP
                    },
                    close: () => {
                      //NOP
                    },
                    toggle: () => {
                      //NOP
                    },
                  }}
                >
                  <SpeechBalloonPopover
                    popoverRef={popoverRef}
                    placement="top"
                    triggerRef={triggerRef}
                    isOpen={Boolean(
                      triggerRefId.includes(
                        // the triggerRef's id will contain the citationId's first part
                        // if it's associated with this citation
                        citationId(cit.citation_number.toString(), ""),
                      ) && isPopoverOpen,
                    )}
                    isNonModal={!citationButtonClicked}
                    onOpenChange={() => {
                      setCitationButtonClicked(false)
                      setTriggerRefId("")
                    }}
                    popoverLabel={`${t("citation")} ${citationNumber}`}
                    {...hoverPopoverProps}
                  >
                    <span
                      className={css`
                        overflow-wrap: break-word;
                        height: fit-content;
                        max-height: 5lh;
                        margin-bottom: 0.5em;
                        mask-image: linear-gradient(0.5turn, black 66%, transparent);
                        h1 {
                          font-size: 1.8rem;
                        }
                        h2 {
                          font-size: 1.5rem;
                        }
                        h3 {
                          font-size: 1.2rem;
                        }
                        h4 {
                          font-size: 1rem;
                        }
                        h5 {
                          font-size: 0.8rem;
                        }
                        h6 {
                          font-size: 0.6rem;
                        }
                      `}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeCourseMaterialHtml(md.render(cit.content)),
                      }}
                    ></span>
                    <p
                      className={css`
                        display: flex;
                        justify-content: space-between;
                        flex-flow: row nowrap;
                        position: relative;
                        gap: 10px;
                      `}
                    >
                      <a
                        href={cit.document_url}
                        className={css`
                          color: ${baseTheme.colors.blue[700]};
                          &::after {
                            content: "";
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                          }
                          &:focus {
                            outline: 2px solid ${baseTheme.colors.green[400]};
                          }
                        `}
                      >
                        <span>
                          <b>
                            {cit.course_material_chapter_number &&
                              `${t("chapter-chapter-number", {
                                number: cit.course_material_chapter_number,
                              })}: `}
                            {`${cit.title}`}
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
                </OverlayTriggerStateContext.Provider>
              </div>
            )
          })}
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
    </>
  )
}

export default ChatbotReferenceList
