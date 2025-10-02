import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { RefObject, useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import CitationPopover from "./CitationPopover"
import { LIGHT_GREEN } from "./styles"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

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
  triggerElement: RefObject<HTMLButtonElement | null>
  triggerElementId: string
  setTriggerElementId: (value: React.SetStateAction<string>) => void
  citationsOpen: boolean
  citationButtonClicked: boolean
  isCitationHovered: boolean
  setCitationButtonClicked: (value: React.SetStateAction<boolean>) => void
  setCitationsOpen: (value: React.SetStateAction<boolean>) => void
}

const ChatbotReferenceList: React.FC<ChatbotReferenceListProps> = ({
  citations,
  citationNumberingMap,
  triggerElement, //
  triggerElementId,
  setTriggerElementId, //
  citationsOpen,
  citationButtonClicked, //
  isCitationHovered, //
  setCitationButtonClicked, //
  setCitationsOpen,
}) => {
  const referenceListId = useId()
  const { t } = useTranslation()

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
                <CitationPopover
                  citation={cit}
                  citationNumber={citationNumber}
                  triggerElement={triggerElement}
                  triggerElementId={triggerElementId}
                  setTriggerElementId={setTriggerElementId}
                  citationButtonClicked={citationButtonClicked}
                  setCitationButtonClicked={setCitationButtonClicked}
                  isCitationHovered={isCitationHovered}
                />
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
