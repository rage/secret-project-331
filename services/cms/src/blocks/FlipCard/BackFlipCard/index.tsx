"use client"

/* oxlint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import BackFlipCardEditor from "./BackFlipCardEditor"
import InnerCardSave from "./BackFlipCardSave"

const BackFlipCardConfiguration: BlockConfiguration = {
  title: "Back Flip Card",
  description: "Back side for the flip card block",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/flip-card"],
  attributes: {},
  edit: BackFlipCardEditor,
  save: InnerCardSave,
}

export default BackFlipCardConfiguration
