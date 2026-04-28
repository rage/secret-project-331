"use client"

/* eslint-disable i18next/no-literal-string */

import UnsupportedEditor from "./UnsupportedEditor"
import UnsupportedSave from "./UnsupportedSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

const UnsupportedBlock: BlockConfiguration = {
  title: "Unsupported block",
  description: "Unsupported component block.",
  category: "design",
  attributes: {},
  edit: UnsupportedEditor,
  save: UnsupportedSave,
}

export default UnsupportedBlock
