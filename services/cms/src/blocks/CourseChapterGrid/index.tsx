"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import CourseGridEditor from "./CourseChapterGridEditor"
import CourseGridSave from "./CourseChapterGridSave"

const CourseChapterGridConfiguration: BlockConfiguration = {
  title: "Chapters Grid",
  description: "Chapters Grid.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: CourseGridEditor,
  save: CourseGridSave,
}

export default CourseChapterGridConfiguration
