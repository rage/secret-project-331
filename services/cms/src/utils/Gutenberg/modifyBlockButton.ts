import { registerBlockStyle, unregisterBlockStyle } from "@wordpress/blocks"

export const modifyBlockButton = (): void => {
  // Unregister default Button blocks from Wordpress
  unregisterBlockStyle("core/button", "default")
  unregisterBlockStyle("core/button", "outline")
  unregisterBlockStyle("core/button", "fill")

  // Add own Button blocks styles
  registerBlockStyle("core/button", {
    name: "material-primary-button",
    label: "Primary",
    isDefault: true,
  })
  registerBlockStyle("core/button", { name: "material-secondary-button", label: "Secondary" })
  registerBlockStyle("core/button", { name: "material-tertiary-button", label: "Tertiary" })
}
