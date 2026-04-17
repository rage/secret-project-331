"use client"

/* eslint-disable i18next/no-literal-string */
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ExercisesInChapterEditor from "./ExercisesInChapterEditor"
import ExercisesInChapterSave from "./ExercisesInChapterSave"

const ExercisesInChapterConfiguration: BlockConfiguration = {
  title: "Exercises In Chapter",
  description: "Exercises In Chapter",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: ExercisesInChapterEditor,
  save: ExercisesInChapterSave,
}

export default ExercisesInChapterConfiguration
