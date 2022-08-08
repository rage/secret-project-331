/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import TableEditor from "./TableEditor"
import TableSave from "./TableSave"

const SponsorConfiguration: BlockConfiguration = {
  title: "TableBox",
  description: "Block for adding custom TableBox",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: TableEditor,
  save: TableSave,
}

export default SponsorConfiguration
