/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import InstructionBoxEditor from "./InstructionBoxEditor"
import InstructionBoxSave from "./InstructionBoxSave"

export interface InstructionBoxAttributes {
  content: string
}

const InstructionBoxConfiguration: BlockConfiguration<InstructionBoxAttributes> = {
  title: "InstructionBox",
  description: "Useful block for instructions",
  category: "text",
  attributes: {
    content: {
      type: "string",
      source: "html",
      selector: "span",
    },
  },
  icon: formatLtr,
  edit: InstructionBoxEditor,
  save: InstructionBoxSave,
}

export default InstructionBoxConfiguration
