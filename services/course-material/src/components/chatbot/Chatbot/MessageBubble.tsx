import { css } from "@emotion/css"
import React, { useMemo, useRef, useState } from "react"
import { useHover } from "react-aria"

import ChatbotReferenceList from "./ChatbotReferenceList"
import RenderedMessage, { MessageRenderType } from "./RenderedMessage"
import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"

// captures citations
export const MATCH_CITATIONS_REGEX = /\[[\w]*?([\d]+)\]/g

export const renumberFilterCitations = (
  message: string,
  citations: ChatbotConversationMessageCitation[],
) => {
  // change the citation_number of the actually cited citations so that
  // the first citation that appears in the msg is 1, the 2nd is 2, etc.
  // and filter out citations that were not cited in the msg.
  // Set preserves the order of the unique items in the array
  const citedDocs = Array.from(message.matchAll(MATCH_CITATIONS_REGEX), (arr, _) =>
    parseInt(arr[1]),
  )
  //console.log(message)

  let citedDocsSet = new Set(citedDocs)
  let uniqueCitations = [...citedDocsSet]
  let renumberedFilteredCitations: ChatbotConversationMessageCitation[] = []

  /*   console.log("citations,", citations)*/
  //console.log("citedDocs", citedDocs)

  uniqueCitations.map((citN, idx) => {
    // renumbers the uniqueCitations to be ordered
    // and creates the renumberedFilteredCitations array
    idx += 1
    let cit = citations.find((c) => c.citation_number === citN)
    if (cit) {
      let modifiedCit = { ...cit }
      // TODO temporarily no renumberinh
      //modifiedCit.citation_number = idx
      renumberedFilteredCitations.push(modifiedCit)
    }
    return idx
  })
  //console.log(renumberedFilteredCitations)

  return { filteredCitations: renumberedFilteredCitations, citedDocs }
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
      background-color: ${baseTheme.colors.gray[100]};
    `
    : `
      margin-left: 2rem;
      align-self: flex-end;
      border: 2px solid ${baseTheme.colors.gray[200]};
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
  })

  const [processedMessage, processedCitations] = useMemo(() => {
    const { filteredCitations, citedDocs } = renumberFilterCitations(message, citations ?? [])

    let renderOption = !isFromChatbot
      ? MessageRenderType.User
      : !citationsOpen || filteredCitations.length == 0
        ? MessageRenderType.ChatbotNoCitations
        : MessageRenderType.ChatbotWithCitations

    let renderedMessage = (
      <RenderedMessage
        renderOption={renderOption}
        citationButtonClicked={citationButtonClicked}
        currentRefId={triggerRef.current?.id}
        message={message}
        citedDocs={citedDocs}
        handleClick={(e) => {
          setCitationButtonClicked(true)
          triggerRef.current = e.currentTarget
        }}
        hoverCitationProps={hoverCitationProps}
      />
    )

    return [renderedMessage, filteredCitations]
  }, [message, citations, isFromChatbot, citationsOpen, hoverCitationProps, citationButtonClicked])

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
            triggerRef={triggerRef}
            citationsOpen={citationsOpen}
            citationButtonClicked={citationButtonClicked}
            isCitationHovered={isCitationHovered}
            setCitationButtonClicked={setCitationButtonClicked}
            setCitationsOpen={setCitationsOpen}
          />
        </div>
      )}

      {isPending && <ThinkingIndicator />}
    </div>
  )
}

export default MessageBubble
