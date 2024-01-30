import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ConditionalBlockEditor from "./ConditionalBlockEditor"
import ConditionalBlockSave from "./ConditionalBlockSave"

export interface ConditionAttributes {
  module_completion: string[]
  instance_enrollment: string[]
}

const ConditionalBlockConfiguration: BlockConfiguration<ConditionAttributes> = {
  title: "ConditionalBlock",
  description: "Conditionally rendered block",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    module_completion: {
      type: "array",
      default: [],
    },
    instance_enrollment: {
      type: "array",
      default: [],
    },
  },
  edit: ConditionalBlockEditor,
  save: ConditionalBlockSave,
}

export default ConditionalBlockConfiguration
