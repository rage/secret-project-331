"use client"

/* eslint-disable i18next/no-literal-string */

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LogoLinkEditor from "./LogoLinkEditor"
import LogoLinkSave from "./LogoLinkSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const LogoLinkConfiguration: BlockConfiguration = {
  title: "Logo Link",
  description: "Logo Link",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: LogoLinkEditor,
  save: LogoLinkSave,
}

export default LogoLinkConfiguration
