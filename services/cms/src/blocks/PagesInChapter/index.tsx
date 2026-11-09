"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import EmptyBlockSave from "../EmptyBlockSave"
import PagesInChapterEditor from "./PagesInChapterEditor"

const PagesInChapterConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Pages In Chapter",
  description: "Pages In Chapter",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: PagesInChapterEditor,
  save: EmptyBlockSave,
}

export default PagesInChapterConfiguration
