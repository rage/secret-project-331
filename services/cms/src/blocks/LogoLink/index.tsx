"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import LogoLinkEditor from "./LogoLinkEditor"
import LogoLinkSave from "./LogoLinkSave"

const LogoLinkConfiguration: BlockConfiguration = {
  title: "Logo Link",
  description: "Logo Link",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: LogoLinkEditor,
  save: LogoLinkSave,
}

export default LogoLinkConfiguration
