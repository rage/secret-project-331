/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import FrontCardEditor from "./FrontCardEditor"
import FrontCardSave from "./FrontCardSave"

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"

const FrontCardConfiguration: BlockConfiguration = {
  title: "Front Card",
  description: "Wrapper block for front card, required for the flip card block to work",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/exercise"],
  attributes: {},
  edit: FrontCardEditor,
  save: FrontCardSave,
}

export default FrontCardConfiguration
