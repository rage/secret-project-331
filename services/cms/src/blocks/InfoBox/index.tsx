/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import InfoBoxEditor from "./InfoBoxEditor"
import InfoBoxSave from "./InfoBoxSave"
import { Deprecated1 } from "./deprecated"

export interface InfoBoxComponentProps {
  backgroundColor: string
  noPadding: boolean
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
    noPadding: {
      type: "boolean",
      default: false,
    },
  },
  edit: InfoBoxEditor,
  save: InfoBoxSave,
  // @ts-expect-error: Wrong type, the deprecations have a different interface for the previous attributes
  deprecated: [Deprecated1],
}

export default InfoBoxConfiguration
