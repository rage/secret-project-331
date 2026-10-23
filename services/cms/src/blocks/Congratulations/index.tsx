"use client"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import EmptyBlockSave from "../EmptyBlockSave"
import CongratulationsEditor from "./CongratulationsEditor"

const CONGRATULATIONS = "Congratulations"

const CongratulationsConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: CONGRATULATIONS,
  description: CONGRATULATIONS,
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: CongratulationsEditor,
  save: EmptyBlockSave,
}

export default CongratulationsConfiguration
