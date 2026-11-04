"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import EmptyBlockSave from "../EmptyBlockSave"
import CourseProgressEditor from "./CourseProgressEditor"

const CourseProgressConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Course Progress",
  description: "Course Progress block.",
  category: MOOCFI_CATEGORY_SLUG,
  edit: CourseProgressEditor,
  save: EmptyBlockSave,
  attributes: {},
}

export default CourseProgressConfiguration
