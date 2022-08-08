/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import HighlightEditor from "./HighlightEditor"
import HighlightSave from "./HighlightSave"

export interface HighlightAttributes {
  title: string
  content: string
}

const HighlightBlockConfiguration: BlockConfiguration<HighlightAttributes> = {
  title: "HighlightBox",
  description: "Block for writing HighlightBox",
  category: "text",
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h2",
    },
    content: {
      type: "string",
      source: "html",
      selector: "span",
    },
  },
  icon: formatLtr,
  edit: HighlightEditor,
  save: HighlightSave,
}

export default HighlightBlockConfiguration
