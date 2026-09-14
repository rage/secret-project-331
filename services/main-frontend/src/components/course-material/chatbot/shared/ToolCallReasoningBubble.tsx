"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  zChatbotConversationMessageReasoning,
  zChatbotConversationMessageToolCall,
} from "@/generated/course-material-api/zod.generated"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

import type { ChatbotConversationMessageWithStatus } from "./ChatbotChatBody"
import ChatbotStatusRow from "./ChatbotStatusRow"
import { ASK_MULTIPLE_CHOICE_QUESTION_TOOL } from "./multipleChoiceQuestions"

const textStyle = css`
  padding: 0 0.5rem;
  color: rgb(0 0 0 / 70%);
  margin: 0.25rem 0;
`

const detailsStyle = css`
  details > summary::marker {
    content: none;
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
  margin: 0 0.5rem 0 1.5rem;
`

// Hoisted because emotion re-serializes and re-hashes the result on every call.
const expandableListStyle = css`
  margin: 0.6rem;
  padding-left: 1.5rem;
`

interface ToolPresentation {
  /** Status shown while the tool call is still streaming in. */
  inProgressStatus: (t: TFunction, toolName: string) => string
  /** Line shown in the expanded list once the call has finished. */
  finishedText: (t: TFunction, toolArguments: string, toolName: string) => string
  /** Collapsed summary label; defaults to the finished text. */
  summaryLabel?: (t: TFunction) => string
  /** Show the expandable summary UI even when there are too few messages for it. */
  forcesCollapsible?: boolean
}

const usingNamedTool = (t: TFunction, toolName: string) =>
  `${t("chatbot-status-using-tool")} "${toolName.replaceAll("_", " ")}"`

const UNKNOWN_TOOL_PRESENTATION: ToolPresentation = {
  inProgressStatus: usingNamedTool,
  finishedText: (t, toolArguments, toolName) =>
    `${t("chatbot-status-using-tool-finished")} "${toolName.replaceAll("_", " ")}" ${toolArguments}`,
  summaryLabel: (t) => t("chatbot-status-used-tools"),
}

const TOOL_PRESENTATIONS: Record<string, ToolPresentation> = {
  azure_ai_search: {
    inProgressStatus: (t) => `${t("chatbot-status-using-tool")} "${t("course-material-search")}"`,
    finishedText: (t, toolArguments) => {
      let query = `""`
      if (toolArguments.length > 0) {
        const parsed: { query: string } = JSON.parse(toolArguments)
        query = `"${parsed.query}"`
      }
      return t("chatbot-status-course-material-search-finished", { query })
    },
    summaryLabel: (t) => t("chatbot-status-course-material-search"),
    forcesCollapsible: true,
  },
  document_lookup: {
    inProgressStatus: usingNamedTool,
    finishedText: (t, toolArguments) => {
      let title = undefined
      if (toolArguments.length > 0) {
        try {
          const parsed: { title?: string } = JSON.parse(toolArguments)
          title = parsed.title && `"${parsed.title}"`
        } catch (e) {
          console.error("Failed to parse document lookup arguments", e)
        }
      }
      return title
        ? t("chatbot-status-document-lookup-finished-title", { title })
        : t("chatbot-status-document-lookup-finished")
    },
    summaryLabel: (t) => t("chatbot-status-document-lookup-finished"),
    forcesCollapsible: true,
  },
  course_finder: {
    inProgressStatus: usingNamedTool,
    finishedText: (t) => t("chatbot-status-course-finder-finished"),
  },
  [ASK_MULTIPLE_CHOICE_QUESTION_TOOL]: {
    // A question the learner will read gets its own bubble once its arguments have arrived
    // whole, so here it is still being written and has no choices to show yet.
    inProgressStatus: (t) => t("chatbot-status-preparing-a-question"),
    // Only questions too malformed to render land here; the rest have their own bubble.
    finishedText: (t) => t("chatbot-status-asked-a-question"),
  },
}

const toolPresentation = (toolName: string): ToolPresentation =>
  TOOL_PRESENTATIONS[toolName] ?? UNKNOWN_TOOL_PRESENTATION

interface ToolCallReasoningBubbleProps {
  messages: ChatbotConversationMessageWithStatus[]
}

const ToolCallReasoningBubble: React.FC<ToolCallReasoningBubbleProps> = ({ messages }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  let summaryText: string
  const inProgressItems = messages.filter((m) => !m.finished)
  const finished = inProgressItems.length === 0
  let collapsible = messages.length > 2

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
        summaryText += toolPresentation(res2.data.tool_name).inProgressStatus(
          t,
          res2.data.tool_name,
        )
      }
    })
    return <ChatbotStatusRow text={summaryText} />
  }
  let expandableText: string[] = []
  let summaryLabels: string[] = []
  messages.forEach((m) => {
    let res1 = zChatbotConversationMessageReasoning.safeParse(m.message.message)
    if (res1.success) {
      expandableText.push(t("chatbot-status-thinking-finished"))
      summaryLabels.push(t("chatbot-status-thinking-finished"))
    }
    let res2 = zChatbotConversationMessageToolCall.safeParse(m.message.message)
    if (res2.success) {
      const toolArguments =
        res2.data.tool_arguments.replaceAll(/[{}]/g, "").length === 0
          ? ""
          : res2.data.tool_arguments
      const presentation = toolPresentation(res2.data.tool_name)
      if (presentation.forcesCollapsible) {
        collapsible = true
      }
      const finishedText = presentation.finishedText(t, toolArguments, res2.data.tool_name)
      expandableText.push(finishedText)
      summaryLabels.push(presentation.summaryLabel?.(t) ?? finishedText)
    }
  })
  summaryText = summaryLabels.slice(0, 2).join(", ")

  if (!collapsible) {
    return (
      <div className={detailsStyle}>
        <div className={textStyle}>{expandableText.join(", ")}</div>
      </div>
    )
  }
  return (
    <div className={detailsStyle}>
      <details open={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <summary>
          <span className={textStyle}>
            {summaryText}
            <DownIcon className={iconStyle(isOpen)} />
          </span>
        </summary>
        <ul className={expandableListStyle}>
          {expandableText.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export default ToolCallReasoningBubble
