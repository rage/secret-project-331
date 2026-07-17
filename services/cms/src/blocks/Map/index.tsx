"use client"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import MapEditor from "./MapEditor"
import MapSave from "./MapSave"

const MAP = "Map"
const MAP_DESCRIPTION = "Map shows countries of student enrolled in a course"

const MapConfiguration: BlockConfiguration = {
  title: MAP,
  description: MAP_DESCRIPTION,
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: MapEditor,
  save: MapSave,
}

export default MapConfiguration
