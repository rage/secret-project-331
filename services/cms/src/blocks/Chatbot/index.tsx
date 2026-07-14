"use client"

/* oxlint-disable i18next/no-literal-string */

import ChatbotEditor from "./ChatbotEditor"
import ChatbotSave from "./ChatbotSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

export interface ChatbotBlockAttributes {
  chatbotConfigurationId: string | undefined
  courseId: string | undefined
}

const ChatbotBlockConfiguration: BlockConfiguration<ChatbotBlockAttributes> = {
  title: "Chatbot",
  description: "Used to embed a chatbot chatbox in course material.",
  category: "other",
  attributes: {
    chatbotConfigurationId: {
      type: "string",
      default: undefined,
    },
    courseId: {
      type: "string",
      default: undefined,
    },
  },
  edit: ChatbotEditor,
  save: ChatbotSave,
}

export default ChatbotBlockConfiguration
