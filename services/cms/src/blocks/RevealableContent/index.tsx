/* eslint-disable i18next/no-literal-string */

import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import RevealableContentEditor from "./RevealableContentEditor"
import RevealableContentSave from "./RevealableContentSave"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
