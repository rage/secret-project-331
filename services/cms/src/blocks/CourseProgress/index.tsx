"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import CourseProgressEditor from "./CourseProgressEditor"
import CourseProgressSave from "./CourseProgressSave"

const CourseProgressConfiguration: BlockConfiguration = {
  title: "Course Progress",
  description: "Course Progress block.",
  category: MOOCFI_CATEGORY_SLUG,
  edit: CourseProgressEditor,
  save: CourseProgressSave,
  attributes: {},
}

export default CourseProgressConfiguration
