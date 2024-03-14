/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import AuthorEditor from "./AuthorEditor"
import AuthorSave from "./AuthorSave"

const AuthorConfiguration: BlockConfiguration = {
  title: "Authors",
  description: "Author Section",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: AuthorEditor,
  save: AuthorSave,
}

export default AuthorConfiguration
