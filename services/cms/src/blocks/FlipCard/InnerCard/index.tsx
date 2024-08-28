/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import InnerCardEditor from "./InnerCardEditor"
import InnerCardSave from "./InnerCardSave"

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"

export interface InnerCardAttributes {
  backgroundColor: string
}

const InnerCardConfiguration: BlockConfiguration<InnerCardAttributes> = {
  title: "Inner Card",
  description:
    "Inner block for the flip card block, two of these are required for the flip card to work",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/flip-card"],
  attributes: {
    backgroundColor: {
      type: "string",
      default: "",
    },
  },
  edit: InnerCardEditor,
  save: InnerCardSave,
}

export default InnerCardConfiguration
