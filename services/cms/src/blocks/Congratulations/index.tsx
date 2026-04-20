"use client"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import CongratulationsEditor from "./CongratulationsEditor"
import CongratulationsSave from "./CongratulationsSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

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
