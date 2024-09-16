/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import ExpandableContentEditor from "./ExpandableContentInnerBlockEditor"
import ExpandableContentSave from "./ExpandableContentInnerBlockSave"

export interface ExpandableContentConfigurationProps {
  name: string
}
const ExpandableContentInnerBlockConfiguration: BlockConfiguration<ExpandableContentConfigurationProps> =
  {
    title: "Expandable Content",
    description: "One or more heading that has expandable/collapsible content",
    category: MOOCFI_CATEGORY_SLUG,
    attributes: { name: { type: "string", default: "" } },
    parent: ["moocfi/expandable-content"],
    edit: ExpandableContentEditor,
    save: ExpandableContentSave,
  }

export default ExpandableContentInnerBlockConfiguration
