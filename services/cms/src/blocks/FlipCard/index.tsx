/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import FlipCardEditor from "./FlipCardEditor"
import FlipCardSave from "./FlipCardSave"

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"

const FlipCardConfiguration: BlockConfiguration = {
  title: "Flip Card",
  description: "Flip Card",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: FlipCardEditor,
  save: FlipCardSave,
}

export default FlipCardConfiguration
