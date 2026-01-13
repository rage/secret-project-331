"use client"
/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import ChatbotEditor from "./ChatbotEditor"
import ChatbotSave from "./ChatbotSave"

export interface ChatbotBlockAttributes {
  chatbotConfigurationId: string | undefined
  courseId: string
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
