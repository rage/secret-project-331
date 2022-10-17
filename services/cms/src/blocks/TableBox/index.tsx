/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import TableEditor from "./TableEditor"
import TableSave from "./TableSave"

export interface TableBoxAttributes {
  width: string | number
}

const TableBoxConfiguration: BlockConfiguration<TableBoxAttributes> = {
  title: "TableBox",
  description: "Block for adding custom TableBox",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    width: {
      type: "string",
    },
  },
  edit: TableEditor,
  save: TableSave,
}

export default TableBoxConfiguration
