import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ExpandableContentEditor from "./ExpandableContentEditor"
import ExpandableContentSave from "./ExpandableContentSave"

// eslint-disable-next-line i18next/no-literal-string
const ExpandableContent = "ExpandableContent"

const ExpandableContentConfiguration: BlockConfiguration = {
  title: ExpandableContent,
  description: ExpandableContent,
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: ExpandableContentEditor,
  save: ExpandableContentSave,
}

export default ExpandableContentConfiguration
