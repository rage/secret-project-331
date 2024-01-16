import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ConditionalBlockEditor from "./ConditionalBlockEditor"
import ConditionalBlockSave from "./ConditionalBlockSave"

export interface ConditionAttributes {
  module_completion: boolean
  instance_enrollment: boolean
}

const ConditionalBlockConfiguration: BlockConfiguration<ConditionAttributes> = {
  title: "ConditionalBlock",
  description: "Block that is rendered given a condition",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    module_completion: {
      type: "boolean",
      default: false,
    },
    instance_enrollment: {
      type: "boolean",
      default: false,
    },
  },
  edit: ConditionalBlockEditor,
  save: ConditionalBlockSave,
}

export default ConditionalBlockConfiguration
