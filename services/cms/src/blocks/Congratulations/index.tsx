import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import CongratulationsEditor from "./CongratulationsEditor"
import CongratulationsSave from "./CongratulationsSave"

const CONGRATULATIONS = "Congratulations"

const CongratulationsConfiguration: BlockConfiguration = {
  title: CONGRATULATIONS,
  description: CONGRATULATIONS,
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: CongratulationsEditor,
  save: CongratulationsSave,
}

export default CongratulationsConfiguration
