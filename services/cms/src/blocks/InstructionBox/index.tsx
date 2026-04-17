"use client"

/* eslint-disable i18next/no-literal-string */
import type { BlockConfiguration } from "@/utils/Gutenberg/types"
import { formatLTR } from "@wordpress/icons"

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
  icon: formatLTR,
  edit: InstructionBoxEditor,
  save: InstructionBoxSave,
}

export default InstructionBoxConfiguration
