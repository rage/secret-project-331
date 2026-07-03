"use client"

/* eslint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import AuthorEditor from "./AuthorEditor"
import AuthorSave from "./AuthorSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const AuthorConfiguration: BlockConfiguration = {
  title: "Authors",
  description: "Section displaying brief bios and photos of the page author(s)",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: AuthorEditor,
  save: AuthorSave,
}

export default AuthorConfiguration
