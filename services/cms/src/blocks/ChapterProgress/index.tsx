/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ChapterProgressEditor from "./ChapterProgressEditor"
import ChapterProgressSave from "./ChapterProgressSave"

const ChapterProgressConfiguration: BlockConfiguration = {
  title: "Chapter Progress",
  description: "Chapter Progress block.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: ChapterProgressEditor,
  save: ChapterProgressSave,
}

export default ChapterProgressConfiguration
