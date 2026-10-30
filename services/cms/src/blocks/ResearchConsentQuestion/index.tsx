"use client"

/* oxlint-disable i18next/no-literal-string */
import { check } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import ResearchConsentCheckBoxEditor from "./ResearchConsentQuestionEditor"
import ResearchConsentCheckBoxSave from "./ResearchConsentQuestionSave"

export interface ResearchConsentQuestionAttributes {
  content: string
}

const ResearchConsentQuestionConfiguration: BlockConfiguration<ResearchConsentQuestionAttributes> =
  {
    apiVersion: 3,
    title: "Research form question",
    description: "Used to add a new question to the research consent form",
    category: "text",
    attributes: {
      content: {
        type: "string",
        isRichText: true,
      },
    },
    icon: check,
    edit: ResearchConsentCheckBoxEditor,
    save: ResearchConsentCheckBoxSave,
  }

export default ResearchConsentQuestionConfiguration
