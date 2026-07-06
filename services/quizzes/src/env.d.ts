// rsbuild's `@rsbuild/core/types` is intentionally NOT referenced here: it declares
// `*.svg -> string`, which merges with (rather than being overridden by) the SVG-as-React-component
// typing below (plugin-svgr exportType: "default"), breaking every `<Svg className=.../>`. We
// re-declare the handful of asset/env types actually used instead.

// SVG imported as a React component (matches svgrOptions.exportType: "default").
declare module "*.svg" {
  import type React from "react"
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>
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
