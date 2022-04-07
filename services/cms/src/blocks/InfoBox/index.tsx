/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import InfoBoxEditor from "./InfoBoxEditor"
import InfoBoxSave from "./InfoBoxSave"

export interface InfoBoxComponentProps {
  title: string
  bodyText: string
}

const InfoBoxConfiguration: BlockConfiguration<InfoBoxComponentProps> = {
  title: "Infobox",
  description: "Infobox with body text and possible heading",
  category: "design",
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h3",
      default: "",
    },
    bodyText: {
      type: "string",
      source: "html",
      selector: "p",
      default: "Infobox body",
    },
  },
  edit: InfoBoxEditor,
  save: InfoBoxSave,
}

export default InfoBoxConfiguration
