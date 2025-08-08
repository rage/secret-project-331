import { css } from "@emotion/css"
import { zipWith } from "lodash"
import React, { useMemo, useRef, useState } from "react"
import { useHover } from "react-aria"

import ChatbotReferenceList from "./ChatbotReferenceList"
import RenderedMessage, { MessageRenderType } from "./RenderedMessage"
import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"

// captures citations
const MATCH_CITATIONS_REGEX = /\[[\w]*?([\d]+)\]/g
// don't capture citations, just detect
const SPLIT_AT_CITATIONS_REGEX = /\[[\w]*?[\d]+\]/g
// also matches a starting whitespace that should be removed
const REPLACE_CITATIONS_REGEX = /\s\[[a-z]*?[0-9]+\]/g

export const getMessagePartsCitationPairs = (message: string, isFromChatbot: boolean) => {
  let pairs: {
    msg: string
    cit_n: number
  }[] = []
  let citedDocs: number[] = []

  // if the message is from user, there are no citations for it so no need to
  // process further
  if (!isFromChatbot) {
    return { pairs, citedDocs, alteredMessage: message }
  }

  citedDocs = Array.from(message.matchAll(MATCH_CITATIONS_REGEX), (arr, _) => parseInt(arr[1]))
  let messageParts = message.split(SPLIT_AT_CITATIONS_REGEX)
  pairs = zipWith(messageParts, citedDocs, (m, c) => {
    return { msg: m, cit_n: c }
  })

  const messageNoCitations = message.replace(REPLACE_CITATIONS_REGEX, "")

  return { pairs, citedDocs, alteredMessage: messageNoCitations }
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
    onHoverEnd: (e) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        throw new Error("This hover is meant to be used on buttons only.")
      }
      if (!citationButtonClicked) {
        triggerRef.current = null
      }
    },
  })

  const [processedMessage, processedCitations] = useMemo(() => {
    const { pairs, citedDocs, alteredMessage } = getMessagePartsCitationPairs(
      message,
      isFromChatbot,
    )
    let filteredCitations = citations
      ? citations.filter((cit) => citedDocs.includes(cit.citation_number))
      : []
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
        message={alteredMessage}
        pairs={pairs}
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
