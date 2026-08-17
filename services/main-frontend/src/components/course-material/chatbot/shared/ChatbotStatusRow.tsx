"use client"

import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"

import ThinkingIndicator from "./ThinkingIndicator"

const LIST_ITEM_ELEMENT = "li"
const DIV_ELEMENT = "div"

const statusRowStyle = css`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.25rem 0;
  padding: 0.25rem 0.5rem;
  width: fit-content;
  max-width: stretch;
  border-radius: 10px;
  border: 2px dashed ${baseTheme.colors.blue[200]};
  background-color: ${baseTheme.colors.blue[50]};
  color: rgb(0 0 0 / 70%);
`

interface ChatbotStatusRowProps {
  /// What the chatbot is doing, already translated.
  text: string
  /// Set where the row is a direct child of the message list, so it needs no wrapper of its own.
  asListItem?: boolean
}

/// What the chatbot is doing right now, shown from the moment a turn starts until it settles.
const ChatbotStatusRow: React.FC<ChatbotStatusRowProps> = ({ text, asListItem = false }) => {
  const Element = asListItem ? LIST_ITEM_ELEMENT : DIV_ELEMENT
  return (
    <Element className={statusRowStyle}>
      {text}
      <ThinkingIndicator />
    </Element>
  )
}

export default ChatbotStatusRow
