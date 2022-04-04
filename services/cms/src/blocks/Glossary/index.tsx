/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import GlossaryEditor from "./GlossaryEditor"
import GlossarySave from "./GlossarySave"

const GlossaryConfiguration: BlockConfiguration = {
  title: "Glossary",
  description: "Glossary.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: GlossaryEditor,
  save: GlossarySave,
}

export default GlossaryConfiguration
