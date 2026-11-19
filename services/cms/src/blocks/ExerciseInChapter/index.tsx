"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import EmptyBlockSave from "../EmptyBlockSave"
import ExercisesInChapterEditor from "./ExercisesInChapterEditor"

const ExercisesInChapterConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Exercises In Chapter",
  description: "Exercises In Chapter",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: ExercisesInChapterEditor,
  save: EmptyBlockSave,
}

export default ExercisesInChapterConfiguration
