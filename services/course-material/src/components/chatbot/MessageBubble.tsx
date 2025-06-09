import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { Remarkable } from "remarkable"

import ThinkingIndicator from "./ThinkingIndicator"

import { baseTheme } from "@/shared-module/common/styles"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

interface MessageBubbleProps {
  message: string
  isFromChatbot: boolean
  isPending: boolean
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

const messageStyle = () => css`
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
  white-space: pre-wrap;
`
let md = new Remarkable()

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFromChatbot,
  isPending,
  hideCitations,
}) => {
  const processedMessage = useMemo(() => {
    let renderedMessage = message
    if (hideCitations) {
      renderedMessage = renderedMessage.replace(/\[.*?\]/g, "")
    }
    if (isFromChatbot) {
      renderedMessage = sanitizeCourseMaterialHtml(md.render(renderedMessage).trim())
    }
    return renderedMessage
  }, [hideCitations, message, isFromChatbot])
  return (
    <div className={bubbleStyle(isFromChatbot)}>
      <span
        className={messageStyle()}
        dangerouslySetInnerHTML={{ __html: processedMessage }}
      ></span>
      {isPending && <ThinkingIndicator />}
    </div>
  )
}

export default React.memo(MessageBubble)
