"use client"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import ExpandableContentEditor from "./ExpandableContentEditor"
import ExpandableContentSave from "./ExpandableContentSave"

// oxlint-disable-next-line i18next/no-literal-string
const ExpandableContent = "ExpandableContent"

const ExpandableContentConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: ExpandableContent,
  description: ExpandableContent,
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  // oxlint-disable-next-line i18next/no-literal-string
  allowedBlocks: ["moocfi/expandable-content-inner-block"],
  edit: ExpandableContentEditor,
  save: ExpandableContentSave,
}

export default ExpandableContentConfiguration
