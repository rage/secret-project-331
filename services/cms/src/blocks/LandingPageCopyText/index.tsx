/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LandingPageCopyTextEditor from "./LandingPageCopyTextEditor"
import LandingPageCopyTextSave from "./LandingPageCopyTextSave"

const LandingPageCopyTextConfiguration: BlockConfiguration = {
  title: "Landing Page Copy Text",
  description: "Block for adding copy text in landing page",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: LandingPageCopyTextEditor,
  save: LandingPageCopyTextSave,
}

export default LandingPageCopyTextConfiguration
