/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import InstructionBoxEditor from "./IngressEditor"
import InstructionBoxSave from "./IngressSave"

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
  icon: formatLtr,
  edit: InstructionBoxEditor,
  save: InstructionBoxSave,
}

export default InstructionBoxConfiguration
