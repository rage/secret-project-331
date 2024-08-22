/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import BackCardEditor from "./BackCardEditor"
import BackCardSave from "./BackCardSave"

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"

const BackCardConfiguration: BlockConfiguration = {
  title: "Back Card",
  description: "Wrapper block for back card, required for the flip card block to work",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/exercise"],
  attributes: {},
  edit: BackCardEditor,
  save: BackCardSave,
}

export default BackCardConfiguration
