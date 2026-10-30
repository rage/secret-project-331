"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import EmptyBlockSave from "../EmptyBlockSave"
import ChapterProgressEditor from "./ChapterProgressEditor"

const ChapterProgressConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Chapter Progress",
  description: "Chapter Progress block.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: ChapterProgressEditor,
  save: EmptyBlockSave,
}

export default ChapterProgressConfiguration
