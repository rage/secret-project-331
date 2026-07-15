"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import UnsupportedEditor from "./UnsupportedEditor"
import UnsupportedSave from "./UnsupportedSave"

const UnsupportedBlock: BlockConfiguration = {
  title: "Unsupported block",
  description: "Unsupported component block.",
  category: "design",
  attributes: {},
  edit: UnsupportedEditor,
  save: UnsupportedSave,
}

export default UnsupportedBlock
