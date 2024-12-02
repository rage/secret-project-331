/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import PartnerEditor from "./PartnersEditor"
import PartnerSave from "./PartnersSave"

const PartnerConfiguration: BlockConfiguration = {
  title: "Partner Section",
  description: "Partner Section",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: PartnerEditor,
  save: PartnerSave,
}

export default PartnerConfiguration
