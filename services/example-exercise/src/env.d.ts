/// <reference types="@rsbuild/core/types" />

// SVG imported as a React component (matches svgrOptions.exportType: "default").
declare module "*.svg" {
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>
  export default ReactComponent
}
declare module "*.svg?url" {
  const url: string
  export default url
}

// Type the PUBLIC_* env vars rsbuild inlines into the bundle.
interface ImportMetaEnv {
  readonly PUBLIC_BASE_PATH: string
}
