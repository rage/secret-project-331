/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import LatexEditor from "./LatexEditor"
import LatexSave from "./LatexSave"

export interface TextAttributes {
  text: string
}

const LatexBlockConfiguration: BlockConfiguration<TextAttributes> = {
  title: "Latex",
  description: "Block for writing LaTex",
  category: "text",
  attributes: {
    text: {
      type: "string",
      default: "",
    },
  },
  icon: formatLtr,
  edit: LatexEditor,
  save: LatexSave,
}

export default LatexBlockConfiguration
