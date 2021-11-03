/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

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
