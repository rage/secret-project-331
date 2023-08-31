/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import AuthorInnerBlockEditor from "./AuthorInnerBlockEditor"
import AuthorInnerBlockSave from "./AuthorInnerBlockSave"

const AuthorInnerBlockConfiguration: BlockConfiguration = {
  title: "AuthorInnerBlock",
  description: "Author InnerBlock",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: AuthorInnerBlockEditor,
  save: AuthorInnerBlockSave,
}

export default AuthorInnerBlockConfiguration
