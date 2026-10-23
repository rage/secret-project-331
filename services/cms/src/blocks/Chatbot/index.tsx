"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import EmptyBlockSave from "../EmptyBlockSave"
import ChatbotEditor from "./ChatbotEditor"

export interface ChatbotBlockAttributes {
  chatbotConfigurationId: string | undefined
  courseId: string | undefined
}

const ChatbotBlockConfiguration: BlockConfiguration<ChatbotBlockAttributes> = {
  apiVersion: 3,
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
  save: EmptyBlockSave,
}

export default ChatbotBlockConfiguration
