import { registerBlockVariation } from "@wordpress/blocks"
import { Path, SVG } from "@wordpress/components"
import { createElement } from "react"

const CORE_EMBED_VARIANT = "core/embed"
const EMBED_EXTRA_VARIATIONS = [
  { name: "Mentimeter", slug: "mentimeter" },
  { name: "Thinglink", slug: "thinglink" },
]

// Copy of block-library's generic embed icon, which the package has no public export for.
const embedContentIcon = createElement(
  SVG,
  { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
  createElement(Path, {
    d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm.5 16c0 .3-.2.5-.5.5H5c-.3 0-.5-.2-.5-.5V9.8l4.7-5.3H19c.3 0 .5.2.5.5v14zm-6-9.5L16 12l-2.5 2.8 1.1 1L18 12l-3.5-3.5-1 1zm-3 0l-1-1L6 12l3.5 3.8 1.1-1L8 12l2.5-2.5z",
  }),
)

export const registerBlockVariations = () => {
  EMBED_EXTRA_VARIATIONS.forEach((variation) => {
    registerBlockVariation(CORE_EMBED_VARIANT, {
      name: variation.slug,
      title: variation.name,
      icon: embedContentIcon,
      attributes: { providerNameSlug: variation.slug },
    })
  })
}
