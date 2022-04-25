/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import InfoBoxEditor from "./InfoBoxEditor"
import InfoBoxSave from "./InfoBoxSave"

export interface InfoBoxComponentProps {
  backgroundColor: string
}

const InfoBoxConfiguration: BlockConfiguration<InfoBoxComponentProps> = {
  title: "Infobox",
  description: "Infobox with body text and possible heading",
  category: "design",
  attributes: {
    backgroundColor: {
      type: "string",
      default: "#faf5f3",
    },
  },
  edit: InfoBoxEditor,
  save: InfoBoxSave,
}

export default InfoBoxConfiguration
