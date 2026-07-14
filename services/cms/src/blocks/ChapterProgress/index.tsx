"use client"

/* oxlint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ChapterProgressEditor from "./ChapterProgressEditor"
import ChapterProgressSave from "./ChapterProgressSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const ChapterProgressConfiguration: BlockConfiguration = {
  title: "Chapter Progress",
  description: "Chapter Progress block.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: ChapterProgressEditor,
  save: ChapterProgressSave,
}

export default ChapterProgressConfiguration
