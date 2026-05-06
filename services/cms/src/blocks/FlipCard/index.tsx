"use client"

/* eslint-disable i18next/no-literal-string */

import FlipCardEditor from "./FlipCardEditor"
import FlipCardSave from "./FlipCardSave"

import { MOOCFI_CATEGORY_SLUG } from "@/utils/Gutenberg/modifyGutenbergCategories"
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

export interface FlipCardAttributes {
  size: string
}
const FlipCardConfiguration: BlockConfiguration<FlipCardAttributes> = {
  title: "Flip Card",
  description: "A two sided flip card that can be flipped by clicking the card",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    size: {
      type: "string",
      default: "xl",
    },
  },
  edit: FlipCardEditor,
  save: FlipCardSave,
}

export default FlipCardConfiguration
