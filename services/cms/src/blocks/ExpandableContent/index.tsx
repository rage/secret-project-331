"use client"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import { containerTransformsTo } from "../containerTransforms"
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
  edit: ExpandableContentEditor,
  save: ExpandableContentSave,
  // oxlint-disable-next-line i18next/no-literal-string
  transforms: { from: containerTransformsTo("moocfi/expandable-content") },
}

export default ExpandableContentConfiguration
