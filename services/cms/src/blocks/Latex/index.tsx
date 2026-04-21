"use client"

/* eslint-disable i18next/no-literal-string */
import { formatLTR } from "@wordpress/icons"

import LatexEditor from "./LatexEditor"
import LatexSave from "./LatexSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

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
  icon: formatLTR,
  edit: LatexEditor,
  save: LatexSave,
}

export default LatexBlockConfiguration
