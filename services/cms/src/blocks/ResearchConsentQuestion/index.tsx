/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import ResearchConsentCheckBoxEditor from "./ResearchConsentQuestionEditor"
import ResearchConsentCheckBoxSave from "./ResearchConsentQuestionSave"

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
    icon: formatLtr,
    edit: ResearchConsentCheckBoxEditor,
    save: ResearchConsentCheckBoxSave,
  }

export default ResearchConsentQuestionConfiguration
