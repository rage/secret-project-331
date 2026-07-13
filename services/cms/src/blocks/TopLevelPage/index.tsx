"use client"

/* oxlint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import TopLevelPageEditor from "./TopLevelPageEditor"
import TopLevelPageSave from "./TopLevelPageSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const TopLevePageConfiguration: BlockConfiguration = {
  title: "Top level pages",
  description: "List of all top level page in a course",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: TopLevelPageEditor,
  save: TopLevelPageSave,
}

export default TopLevePageConfiguration
