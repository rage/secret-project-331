// Don't reference `@rsbuild/core/types`: it declares `*.svg -> string`, which merges with (rather
// than overrides) the SVG-as-React-component typing below and breaks every `<Svg className=.../>`.
// Re-declare only the asset/env types actually used.

// SVG imported as a React component (matches svgrOptions.exportType: "default").
declare module "*.svg" {
  import type ReactTypes from "react"
  const ReactComponent: ReactTypes.FunctionComponent<
    ReactTypes.SVGProps<SVGSVGElement> & { title?: string }
  >
  export default ReactComponent
}
declare module "*.svg?url" {
  const url: string
  export default url
}
// Side-effect stylesheet imports (@fontsource, katex, ...).
declare module "*.css"

// PUBLIC_* env vars rsbuild inlines into the bundle at build time.
interface ImportMetaEnv {
  readonly PUBLIC_BASE_PATH: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
