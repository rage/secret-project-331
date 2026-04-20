"use client"

/* eslint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LandingPageCopyTextEditor from "./LandingPageCopyTextEditor"
import LandingPageCopyTextSave from "./LandingPageCopyTextSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const LandingPageCopyTextConfiguration: BlockConfiguration = {
  title: "Landing Page Copy Text",
  description: "Block for adding copy text in landing page",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: LandingPageCopyTextEditor,
  save: LandingPageCopyTextSave,
}

export default LandingPageCopyTextConfiguration
