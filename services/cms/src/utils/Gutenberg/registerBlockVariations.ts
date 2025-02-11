// @ts-expect-error: no type definition
import { embedContentIcon } from "@wordpress/block-library/build-module/embed/icons"
/* @ts-expect-error: type signature incorrect */
import { registerBlockVariation } from "@wordpress/blocks"

const CORE_EMBED_VARIANT = "core/embed"
const EMBED_EXTRA_VARIATIONS = [
  { name: "Mentimeter", slug: "mentimeter" },
  { name: "Thinglink", slug: "thinglink" },
]

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
