/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import ExerciseSettingsEditor from "./ExerciseSettingsEditor"
import ExerciseSettingsSave from "./ExerciseSettingsSave"

const ExerciseSettingsConfiguration: BlockConfiguration<Record<string, never>> = {
  title: "ExerciseSettings",
  description: "Wrapper block for exercise settings, required for the exercise block to work",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/exercise"],
  attributes: {},
  edit: ExerciseSettingsEditor,
  save: ExerciseSettingsSave,
}

export default ExerciseSettingsConfiguration
