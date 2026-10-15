"use client"

import { createContext } from "react"

/**
 * Provides the enclosing list block's `fontSize` to its list items. A list item without its own
 * `fontSize` falls back to this so it inherits the list-level size.
 * See ListBlock (provider) and ListItemBlock (consumer).
 */
const ListFontSizeContext = createContext<string | undefined>(undefined)

export default ListFontSizeContext
