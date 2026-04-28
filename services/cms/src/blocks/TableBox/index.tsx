"use client"

/* eslint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import TableEditor from "./TableEditor"
import TableSave from "./TableSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

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
      default: "",
    },
  },
  edit: TableEditor,
  save: TableSave,
}

export default TableBoxConfiguration
