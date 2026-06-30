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
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

const textStyle = css`
  padding: 0.5rem;
  color: rgb(0 0 0 / 70%);
  margin: 0.5rem 0 0.1rem 0;
  overflow: visible;
`

const detailsStyle = css`
  details > summary::marker {
    content: none;
  }
  details > summary::-webkit-details-marker {
    display: none;
  }
  details > summary {
    cursor: pointer;
    display: flex;
    flex-flow: row nowrap;
    justify-content: space-between;
    align-items: baseline;
  }
  color: rgb(0 0 0 / 70%);
  border-radius: 10px;
  padding: 0.25rem;
  width: fit-content;
  max-width: stretch;
  border: 2px dashed ${baseTheme.colors.blue[200]};
  background-color: ${baseTheme.colors.blue[50]};
`

const iconStyle = (open: boolean) => css`
  transform: scale(0.8) ${open ? " rotate(180deg)" : ""};
  transition: transform 0.2s ease;
  flex: 1;
  margin: 0 1rem 0 1.5rem;
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

  let summaryText: string
  let inProgressItems = messages.filter((m) => {
    return !m.finished
  })
  let finished = inProgressItems.length === 0
  let collapse = messages.length > 2

  if (!finished) {
    summaryText = ""
    inProgressItems.forEach((m, idx) => {
      if (idx !== 0) {
        summaryText += ", "
      }
      let res1 = zChatbotConversationMessageReasoning.safeParse(m.message.message)
      if (res1.success) {
        summaryText += t("chatbot-status-thinking")
      }
      let res2 = zChatbotConversationMessageToolCall.safeParse(m.message.message)
      if (res2.success) {
        const tool_arguments =
          res2.data.tool_arguments.replaceAll(/[{}]/g, "").length === 0
            ? ""
            : ` ${res2.data.tool_arguments}`
        summaryText += `${t("chatbot-status-using-tool")} "${res2.data.tool_name.replaceAll("_", " ")}"${tool_arguments}`
      }
    })
    return (
      <span className={detailsStyle}>
        {summaryText} {<ThinkingIndicator />}
      </span>
    )
  } else {
    summaryText = ""
    let expandableText: string[] = []
    messages.forEach((m, idx) => {
      let res1 = zChatbotConversationMessageReasoning.safeParse(m.message.message)
      if (res1.success) {
        expandableText.push(t("chatbot-status-thinking-finished"))
        if (idx === 0) {
          summaryText += t("chatbot-status-thinking-finished")
        }
      }
      let res2 = zChatbotConversationMessageToolCall.safeParse(m.message.message)
      if (res2.success) {
        const toolArguments =
          res2.data.tool_arguments.replaceAll(/[{}]/g, "").length === 0
            ? ""
            : ` ${res2.data.tool_arguments}`
        if (res2.data.tool_name === "course material search") {
          expandableText.push(
            t("chatbot-status-course-material-search-finished", { query: toolArguments }),
          )
          if (idx === 0) {
            summaryText += t("chatbot-status-course-material-search")
          }
        } else {
          expandableText.push(
            `${t("chatbot-status-using-tool-finished")} "${res2.data.tool_name.replaceAll("_", " ")}" ${toolArguments}`,
          )
          if (idx === 0) {
            summaryText += t("chatbot-status-used-tools")
          }
        }
      }
    })
    summaryText += t("chatbot-status-other-actions", { n: messages.length - 1 })

    if (!collapse) {
      return (
        <div className={detailsStyle}>
          <span className={textStyle}>{expandableText.join(", ")}</span>
        </div>
      )
    }
    return (
      <div className={detailsStyle}>
        <details open={false} onToggle={() => setIsOpen(!isOpen)}>
          <summary>
            <span className={textStyle}>{summaryText}</span>
            {collapse && <DownIcon className={iconStyle(isOpen)} />}
          </summary>
          <ul>
            {expandableText.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
    )
  }
}

export default StatusIndicator
