/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import SponsorEditor from "./SponsorEditor"
import SponsorSave from "./SponsorSave"

const SponsorConfiguration: BlockConfiguration = {
  title: "Sponsors",
  description: "Partners in this course",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: SponsorEditor,
  save: SponsorSave,
}

export default SponsorConfiguration
