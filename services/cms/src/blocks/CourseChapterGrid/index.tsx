"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import EmptyBlockSave from "../EmptyBlockSave"
import CourseGridEditor from "./CourseChapterGridEditor"

const CourseChapterGridConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Chapters Grid",
  description: "Chapters Grid.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: CourseGridEditor,
  save: EmptyBlockSave,
}

export default CourseChapterGridConfiguration
