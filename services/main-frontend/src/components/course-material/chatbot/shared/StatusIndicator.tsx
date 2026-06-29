"use client"

import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ChatbotConversationMessageWithStatus } from "./ChatbotChatBody"
import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotConversationMessageToolCall } from "@/generated/course-material-api/types.generated"
import {
  zChatbotConversationMessageReasoning,
  zChatbotConversationMessageToolCall,
} from "@/generated/course-material-api/zod.generated"
import Accordion from "@/shared-module/common/components/Accordion"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

const style = css`
  padding: 0.5rem;
  border-radius: 10px;
  width: fit-content;
  max-width: stretch;
  color: rgb(0 0 0 / 70%);
  overflow-wrap: break-word;
  margin: 0.5rem 0 0.1rem 0;
  margin-right: 2rem;
  align-self: flex-start;
`

const detailsStyle = css`
  details > summary::marker {
    content: none;
  }
  details > summary::-webkit-details-marker {
    display: none;
  }
  details[open] > summary::marker {
    transform: rotate(180deg);
  }
  details > summary {
    cursor: pointer;
  }

  color: rgb(0 0 0 / 70%);

  border-radius: 10px;
  padding: 0.25rem;
  width: fit-content;
  max-width: stretch;
  border: 2px dashed ${baseTheme.colors.blue[200]};
  background-color: ${baseTheme.colors.blue[50]};
`

// controlled
export type ReasoningStatusProps = {
  messages: ChatbotConversationMessageWithStatus[]
}

export type ToolCallStatusProps = {
  messageType: "ToolCall"
  message: ChatbotConversationMessageToolCall
  finished: boolean
}

type StatusIndicatorProps = ReasoningStatusProps

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ messages }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  let statusText: string
  let inProgressItems = messages.filter((m) => {
    return !m.finished
  })
  let finished = inProgressItems.length === 0
  let collapse = messages.length > 2

  if (!finished) {
    statusText = ""
    inProgressItems.forEach((m, idx) => {
      if (idx !== 0) {
        statusText += ", "
      }
      let res1 = zChatbotConversationMessageReasoning.safeParse(m.message.message)
      if (res1.success) {
        statusText += t("chatbot-status-thinking")
      }
      let res2 = zChatbotConversationMessageToolCall.safeParse(m.message.message)
      if (res2.success) {
        const tool_arguments =
          res2.data.tool_arguments.replaceAll(/[{}]/g, "").length === 0
            ? ""
            : ` ${res2.data.tool_arguments}`
        statusText += `${t("chatbot-status-using-tool")} "${res2.data.tool_name.replaceAll("_", " ")}"${tool_arguments}`
      }
    })
    return (
      <span className={style}>
        {statusText} {<ThinkingIndicator />}
      </span>
    )
  } else {
    statusText = ""
    // eslint-disable-next-line i18next/no-literal-string
    let fullText = ["Thought of an answer", "Used tool 'bogus'"] // if shoould collapse, this is the content
    messages.forEach((m, idx) => {
      if (idx !== 0) {
        statusText += ", "
      }
      let res1 = zChatbotConversationMessageReasoning.safeParse(m.message.message)
      if (res1.success) {
        statusText += t("chatbot-status-thinking-finished")
      }
      let res2 = zChatbotConversationMessageToolCall.safeParse(m.message.message)
      if (res2.success) {
        const tool_arguments =
          res2.data.tool_arguments.replaceAll(/[{}]/g, "").length === 0
            ? ""
            : ` ${res2.data.tool_arguments}`
        statusText += `${t("chatbot-status-using-tool-finished")} "${res2.data.tool_name.replaceAll("_", " ")}"${tool_arguments}`
      }
    })
    return (
      <div className={detailsStyle}>
        <details>
          <summary>
            <span className={style}>{statusText}</span>
            <DownIcon />
          </summary>
          <span>{fullText}</span>
        </details>
      </div>
    )
  }
}

/* if (messageType === "Reasoning") {
    statusText = finished ? t("chatbot-status-thinking-finished") : t("chatbot-status-thinking")
  } else {
    const tool_arguments =
      message.tool_arguments.replaceAll(/[{}]/g, "").length === 0
        ? ""
        : ` ${message.tool_arguments}`
    const tool_text = finished
      ? t("chatbot-status-using-tool-finished")
      : t("chatbot-status-using-tool")
    statusText = `${tool_text} "${message.tool_name.replaceAll("_", " ")}"${tool_arguments}`
  } */

export default StatusIndicator
