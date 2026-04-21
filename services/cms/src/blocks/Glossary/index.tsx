"use client"

/* eslint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import GlossaryEditor from "./GlossaryEditor"
import GlossarySave from "./GlossarySave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const GlossaryConfiguration: BlockConfiguration = {
  title: "Glossary",
  description: "Glossary.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: GlossaryEditor,
  save: GlossarySave,
}

export default GlossaryConfiguration
