"use client"

import { css } from "@emotion/css"
import React, { useMemo, useRef, useState } from "react"
import { useHover } from "react-aria"

import ChatbotReferenceList from "./ChatbotReferenceList"
import CitationPopovers from "./CitationPopovers"
import RenderedMessage, { MessageRenderType } from "./RenderedMessage"
import ThinkingIndicator from "./ThinkingIndicator"
import { LIGHT_GREEN } from "./styles"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"
import { MATCH_CITATIONS_REGEX } from "@/utils/course-material/chatbotCitationRegexes"

export const renumberFilterCitations = (
  message: string,
  citations: ChatbotConversationMessageCitation[],
  isFromChatbot: boolean,
) => {
  /** change the citation_number of the actually cited citations so that
  the first citation that appears in the msg is 1, the 2nd is 2, etc.
  and filter out citations that were not cited in the msg. */

  if (!isFromChatbot) {
    return { filteredCitations: [], citedDocs: [], citationNumberingMap: new Map() }
  }

  let citedDocs = Array.from(message.matchAll(MATCH_CITATIONS_REGEX), (arr, _) => parseInt(arr[1]))

  // there might be hallucinated citations in the message :(
  // remove the hallucinated citations
  const actualCitationNs: number[] = citations.map((c) => c.citation_number)
  citedDocs = citedDocs.filter((v) => actualCitationNs.includes(v))
  // Set preserves the order of the unique items in the array
  let citedDocsSet = new Set(citedDocs)

  let uniqueCitations = Array.from(citedDocsSet)

  uniqueCitations = uniqueCitations.filter((v) => actualCitationNs.includes(v))

  let filteredCitations: ChatbotConversationMessageCitation[] = []
  let citationNumberingMap = new Map()
  let citedPages = new Map()
  let n = 1

  uniqueCitations.forEach((citN) => {
    // renumbers the uniqueCitations to be ordered,
    // saves the renumbering in a map and filters the citations
    let cit = citations.find((c) => c.citation_number === citN)
    if (!cit) {
      throw new Error(
        "The citation should be found because uniqueCitations is created based on citations",
      )
    }
    if (citedPages.has(cit.document_url)) {
      // already cited, so set the citN as the same as the earlier of the same page
      citationNumberingMap.set(cit.citation_number, citedPages.get(cit.document_url))
    } else {
      citationNumberingMap.set(cit.citation_number, n)
      citedPages.set(cit.document_url, n)
      n += 1
    }
    filteredCitations.push(cit)
  })

  // none of these include hallucinated citations
  return { filteredCitations, citedDocs, citationNumberingMap }
}

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
      background-color: ${LIGHT_GREEN};
    `
    : `
      margin-left: 2rem;
      align-self: flex-end;
      border: 2px solid ${baseTheme.colors.green[200]};
      background-color: #ffffff;
    `}
`

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFromChatbot,
  isPending,
  citations,
}) => {
  // the ref is updated manually because there are multiple trigger elements for the popover
  // that need to be able to be set as the ref conditionally
  let triggerElement = useRef<HTMLButtonElement>(null)
  let [triggerElementId, setTriggerElementId] = useState("")

  const [citationsOpen, setCitationsOpen] = useState(false)
  const [citationButtonClicked, setCitationButtonClicked] = useState(false)

  let { hoverProps: hoverCitationProps, isHovered: isCitationHovered } = useHover({
    onHoverStart: (e) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        throw new Error("This hover is meant to be used on buttons only.")
      }
      triggerElement.current = e.target
      setTriggerElementId(e.target.id)
    },
  })

  const renumberFilterCitationsResult = useMemo(() => {
    return renumberFilterCitations(message, citations ?? [], isFromChatbot)
  }, [message, citations, isFromChatbot])

  const [processedMessage, processedCitations, citationNumberingMap] = useMemo(() => {
    const { filteredCitations, citedDocs, citationNumberingMap } = renumberFilterCitationsResult

    let renderOption = !isFromChatbot
      ? MessageRenderType.User
      : !citationsOpen || filteredCitations.length == 0
        ? MessageRenderType.ChatbotNoCitations
        : MessageRenderType.ChatbotWithCitations

    let renderedMessage = (
      <RenderedMessage
        renderOption={renderOption}
        citationButtonClicked={citationButtonClicked}
        currentTriggerId={triggerElementId}
        message={message}
        citedDocs={citedDocs}
        citationNumberingMap={citationNumberingMap}
        handleClick={(e) => {
          setCitationButtonClicked(true)
          triggerElement.current = e.currentTarget
          setTriggerElementId(e.currentTarget.id)
        }}
        hoverCitationProps={hoverCitationProps}
      />
    )

    return [renderedMessage, filteredCitations, citationNumberingMap]
  }, [
    message,
    isFromChatbot,
    citationsOpen,
    hoverCitationProps,
    citationButtonClicked,
    renumberFilterCitationsResult,
    triggerElementId,
  ])

  return (
    <div className={bubbleStyle(isFromChatbot)}>
      {processedMessage}

      {isFromChatbot && processedCitations.length > 0 && (
        <div
          className={css`
            margin-top: 15px;
          `}
        >
          <hr
            className={css`
              opacity: 40%;
            `}
          ></hr>
          <ChatbotReferenceList
            citations={processedCitations}
            citationNumberingMap={citationNumberingMap}
            citationsOpen={citationsOpen}
            setCitationsOpen={setCitationsOpen}
          />
          <CitationPopovers
            citations={processedCitations}
            citationNumberingMap={citationNumberingMap}
            triggerElement={triggerElement}
            triggerElementId={triggerElementId}
            setTriggerElementId={setTriggerElementId}
            citationButtonClicked={citationButtonClicked}
            setCitationButtonClicked={setCitationButtonClicked}
            isCitationHovered={isCitationHovered}
          />
        </div>
      )}

      {isPending && <ThinkingIndicator />}
    </div>
  )
}

export default MessageBubble
