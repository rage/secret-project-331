/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"
import { formatLtr } from "@wordpress/icons"

import HighlightEditor from "./HighlightEditor"
import HighlightSave from "./HighlightSave"

export interface HighlightAttributes {
  title: string
  content: string
}

const HighlightBoxConfiguration: BlockConfiguration<HighlightAttributes> = {
  title: "HighlightBox",
  description: "Useful block for a table of definitions",
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

export default HighlightBoxConfiguration
