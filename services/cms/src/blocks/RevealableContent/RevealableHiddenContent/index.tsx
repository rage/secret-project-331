/* eslint-disable i18next/no-literal-string */

import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import RevealableHiddenContentEditor from "./RevealableHiddenContentEditor"
import RevealableHiddenContentSave from "./RevealableHiddenContentSave"

export interface ConditionAttributes {}

const RevealableHiddenContentConfiguration: BlockConfiguration<ConditionAttributes> = {
  title: "Revealable Content",
  description: "Add text and then hidden content that can be revealed with button",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  parent: ["moocfi/revealable-content"],
  edit: RevealableHiddenContentEditor,
  save: RevealableHiddenContentSave,
}

export default RevealableHiddenContentConfiguration
