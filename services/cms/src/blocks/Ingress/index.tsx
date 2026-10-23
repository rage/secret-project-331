"use client"

/* oxlint-disable i18next/no-literal-string */
import { formatLTR } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import InstructionBoxEditor from "./IngressEditor"
import InstructionBoxSave from "./IngressSave"

export interface InstructionBoxAttributes {
  title: string
  subtitle: string
}

const InstructionBoxConfiguration: BlockConfiguration<InstructionBoxAttributes> = {
  apiVersion: 3,
  title: "Ingress",
  description: "Ingress",
  category: "text",
  attributes: {
    title: {
      type: "string",
      isRichText: true,
      default: "Welcome message for course...",
    },
    subtitle: {
      type: "string",
      isRichText: true,
    },
  },
  icon: formatLTR,
  edit: InstructionBoxEditor,
  save: InstructionBoxSave,
}

export default InstructionBoxConfiguration
