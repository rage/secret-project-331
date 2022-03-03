/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import BlockquoteEditor from "./BlockquoteEditor"
import BlockquoteSave from "./BlockquoteSave"

export interface BlockquoteComponentProps {
  bodyText: string
  cite: string
}

const BlockquoteConfiguration: BlockConfiguration<BlockquoteComponentProps> = {
  title: "Blockquote",
  description: "A hero section for chapter front page with a heading and subheading.",
  category: "design",
  attributes: {
    bodyText: {
      type: "string",
      source: "html",
      selector: "p",
      default: "Blockquote body",
    },
    cite: {
      type: "string",
      source: "html",
      selector: "p",
      default: "Blockquote cite",
    },
  },
  edit: BlockquoteEditor,
  save: BlockquoteSave,
}

export default BlockquoteConfiguration
