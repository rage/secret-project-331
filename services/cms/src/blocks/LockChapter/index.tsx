/* eslint-disable i18next/no-literal-string */
"use client"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LockChapterEditor from "./LockChapterEditor"
import LockChapterSave from "./LockChapterSave"

const LockChapterConfiguration: BlockConfiguration = {
  title: "Lock Chapter",
  description: "Button for students to lock chapter (mark as done).",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: LockChapterEditor,
  save: LockChapterSave,
}

export default LockChapterConfiguration
