"use client"

/* oxlint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import AuthorInnerBlockEditor from "./AuthorInnerBlockEditor"
import AuthorInnerBlockSave from "./AuthorInnerBlockSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const AuthorInnerBlockConfiguration: BlockConfiguration = {
  title: "AuthorInnerBlock",
  description: "Author InnerBlock",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  parent: ["moocfi/author"],
  edit: AuthorInnerBlockEditor,
  save: AuthorInnerBlockSave,
}

export default AuthorInnerBlockConfiguration
