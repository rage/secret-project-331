"use client"

/* eslint-disable i18next/no-literal-string */
import { formatLTR } from "@wordpress/icons"

import ResearchConsentCheckBoxEditor from "./ResearchConsentQuestionEditor"
import ResearchConsentCheckBoxSave from "./ResearchConsentQuestionSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

export interface ResearchConsentQuestionAttributes {
  content: string
}

const ResearchConsentQuestionConfiguration: BlockConfiguration<ResearchConsentQuestionAttributes> =
  {
    title: "Research Form Question",
    description: "Used to add a new question to the research consent form",
    category: "text",
    attributes: {
      content: {
        type: "string",
        source: "html",
        selector: "span",
      },
    },
    icon: formatLTR,
    edit: ResearchConsentCheckBoxEditor,
    save: ResearchConsentCheckBoxSave,
  }

export default ResearchConsentQuestionConfiguration
