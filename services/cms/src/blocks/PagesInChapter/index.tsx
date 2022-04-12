/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import PagesInChapterEditor from "./PagesInChapterEditor"
import PagesInChapterSave from "./PagesInChapterSave"

const PagesInChapterConfiguration: BlockConfiguration = {
  title: "Pages In Chapter",
  description: "Pages In Chapter",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: PagesInChapterEditor,
  save: PagesInChapterSave,
}

export default PagesInChapterConfiguration
