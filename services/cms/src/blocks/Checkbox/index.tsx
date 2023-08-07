/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import CheckBoxEditor from "./CheckBoxEditor"
import CheckBoxSave from "./CheckBoxSave"

export interface CheckBoxAttributes {
  content: string
}

const CheckBoxConfiguration: BlockConfiguration<CheckBoxAttributes> = {
  title: "CheckBox",
  description: "Checkbox block",
  category: "text",
  attributes: {
    content: {
      type: "string",
      source: "html",
      selector: "span",
    },
  },
  icon: formatLtr,
  edit: CheckBoxEditor,
  save: CheckBoxSave,
}

export default CheckBoxConfiguration
