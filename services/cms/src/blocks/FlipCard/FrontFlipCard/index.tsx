/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import FrontFlipCardEditor from "./FrontFlipCardEditor"
import FrontFlipCardSave from "./FrontFlipCardSave"

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"

const FrontFlipCardConfiguration: BlockConfiguration = {
  title: "Inner Card",
  description: "Front side for the flip card block",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/flip-card"],
  attributes: {},
  edit: FrontFlipCardEditor,
  save: FrontFlipCardSave,
}

export default FrontFlipCardConfiguration
