"use client"

/* oxlint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import RevealableHiddenContentEditor from "./RevealableHiddenContentEditor"
import RevealableHiddenContentSave from "./RevealableHiddenContentSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

// oxlint-disable-next-line typescript/no-empty-object-type
export interface ConditionAttributes {}

const RevealableHiddenContentConfiguration: BlockConfiguration<ConditionAttributes> = {
  title: "Hidden Content",
  description: "This content is hidden and it can be revealed with pressing a button",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  parent: ["moocfi/revealable-content"],
  edit: RevealableHiddenContentEditor,
  save: RevealableHiddenContentSave,
}

export default RevealableHiddenContentConfiguration
