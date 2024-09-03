/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import CodeGiveawayBlockEditor from "./CodeGiveawayBlockEditor"
import CodeGiveawayBlockSave from "./CodeGiveawayBlockSave"

export interface ConditionAttributes {
  code_giveaway_id: string
}

const ConditionalBlockConfiguration: BlockConfiguration<ConditionAttributes> = {
  title: "CodeGiveaway",
  description:
    "Used to place a code giveaway to a page. Make sure to have created a code giveaway in the manage page.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    code_giveaway_id: {
      type: "string",
      default: "",
    },
  },
  edit: CodeGiveawayBlockEditor,
  save: CodeGiveawayBlockSave,
}

export default ConditionalBlockConfiguration
