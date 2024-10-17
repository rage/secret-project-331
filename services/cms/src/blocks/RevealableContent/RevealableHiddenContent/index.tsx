/* eslint-disable i18next/no-literal-string */

import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import RevealableHiddenContentEditor from "./RevealableHiddenContentEditor"
import RevealableHiddenContentSave from "./RevealableHiddenContentSave"

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
