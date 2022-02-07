/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import GlossaryEditor from "./GlossaryEditor"
import GlossarySave from "./GlossarySave"

const GlossaryConfiguration: BlockConfiguration = {
  title: "Glossary",
  description: "Glossary.",
  category: "design",
  attributes: {},
  edit: GlossaryEditor,
  save: GlossarySave,
}

export default GlossaryConfiguration
