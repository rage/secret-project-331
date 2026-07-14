"use client"

/* oxlint-disable i18next/no-literal-string */
import { formatLTR } from "@wordpress/icons"

import InstructionBoxEditor from "./IngressEditor"
import InstructionBoxSave from "./IngressSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

export interface InstructionBoxAttributes {
  title: string
  subtitle: string
}

const InstructionBoxConfiguration: BlockConfiguration<InstructionBoxAttributes> = {
  title: "Ingress",
  description: "Ingress",
  category: "text",
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h1",
      default: "Welcome message for course...",
    },
    subtitle: {
      type: "string",
      source: "html",
      selector: "p",
    },
  },
  icon: formatLTR,
  edit: InstructionBoxEditor,
  save: InstructionBoxSave,
}

export default InstructionBoxConfiguration
