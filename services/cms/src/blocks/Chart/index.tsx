"use client"

/* eslint-disable i18next/no-literal-string */
import { image as icon } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import ChartEditor from "./ChartEditor"
import ChartSave from "./ChartSave"
import { DEFAULT_CHART_HEIGHT } from "./chartSpec"

export interface ChartAttributes {
  spec: string
  caption: string
  /** Chart height in pixels; width is responsive. */
  height: number
  /** Whether `height` is still the automatic size rather than one the teacher picked. Multi-view
   * charts show at their full natural height while this holds. */
  heightIsAuto: boolean
  /** The chart's uploaded data file, if any. Kept here rather than in `spec` so that editing the
   * spec cannot lose it. */
  dataFileUrl?: string | undefined
}

export { DEFAULT_CHART_HEIGHT }

const ChartConfiguration: BlockConfiguration<ChartAttributes> = {
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
    // A new chart sizes itself until the teacher drags the resize handle.
    heightIsAuto: {
      type: "boolean",
      default: true,
    },
    // No default: unset means no data file has been attached.
    dataFileUrl: {
      type: "string",
    },
  },
  icon,
  edit: ChartEditor,
  save: ChartSave,
}

export default ChartConfiguration
