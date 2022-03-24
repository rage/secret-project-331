// @ts-ignore: no type definition
import { embedContentIcon } from "@wordpress/block-library/build-module/embed/icons"
/* @ts-ignore: type signature incorrect */
import { registerBlockVariation } from "@wordpress/blocks"

const CORE_EMBED_VARIANT = "core/embed"
const MENTI_TITLE = "Mentimeter"
const MENTI_SLUG = "mentimeter"

export const registerBlockVariations = () => {
  registerBlockVariation(CORE_EMBED_VARIANT, {
    name: MENTI_SLUG,
    title: MENTI_TITLE,
    icon: embedContentIcon,
    attributes: { providerNameSlug: MENTI_SLUG },
  })
}
