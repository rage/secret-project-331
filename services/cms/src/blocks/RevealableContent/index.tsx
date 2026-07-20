"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import RevealableContentEditor from "./RevealableContentEditor"
import RevealableContentSave from "./RevealableContentSave"

// oxlint-disable-next-line typescript/no-empty-object-type
export interface ConditionAttributes {}

const RevealableContentConfiguration: BlockConfiguration<ConditionAttributes> = {
  title: "Revealable Content",
  description: "Add text and then hidden content that can be revealed with button",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: RevealableContentEditor,
  save: RevealableContentSave,
}

export default RevealableContentConfiguration
