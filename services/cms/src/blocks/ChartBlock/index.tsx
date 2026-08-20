"use client"

/* eslint-disable i18next/no-literal-string */
import { image as icon } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import ChartBlockEditor from "./ChartBlockEditor"
import ChartBlockSave from "./ChartBlockSave"
import { DEFAULT_CHART_HEIGHT } from "./chartSpec"

export interface ChartBlockAttributes {
  spec: string
  caption: string
  /** Chart height in pixels; width is responsive. */
  height: number
  /** Whether `height` is still the automatic size rather than one the teacher picked. Multi-view
   * charts show at their full natural height while this holds. Absent on blocks saved before the
   * attribute existed; see isAutoHeight. */
  heightIsAuto?: boolean
}

export { DEFAULT_CHART_HEIGHT }

const ChartBlockConfiguration: BlockConfiguration<ChartBlockAttributes> = {
  apiVersion: 3,
  title: "Chart",
  description: "Renders a Vega-Lite chart from a JSON specification",
  category: "text",
  attributes: {
    spec: {
      type: "string",
      // Empty by default so a new block starts data-first: the editor asks for a data file before
      // revealing the spec editor.
      default: "",
    },
    caption: {
      type: "string",
      default: "",
    },
    height: {
      type: "number",
      default: DEFAULT_CHART_HEIGHT,
    },
    // No default: an unset flag means the height has never been chosen.
    heightIsAuto: {
      type: "boolean",
    },
  },
  icon,
  edit: ChartBlockEditor,
  save: ChartBlockSave,
}

export default ChartBlockConfiguration
