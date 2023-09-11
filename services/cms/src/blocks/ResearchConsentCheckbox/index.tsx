/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import ResearchConsentCheckBoxEditor from "./ResearchConsentCheckBoxEditor"
import ResearchConsentCheckBoxSave from "./ResearchConsentCheckBoxSave"

export interface CheckBoxAttributes {
  content: string
}

const CheckBoxConfiguration: BlockConfiguration<CheckBoxAttributes> = {
  title: "CheckBox",
  description: "Checkbox block, only used for the teacher editable research questions",
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

export default CheckBoxConfiguration
