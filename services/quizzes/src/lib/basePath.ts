/** Base path the service is mounted under. Reads PUBLIC_BASE_PATH, which rsbuild inlines into both bundles at build time. */
export default function basePath(): string {
  return import.meta.env.PUBLIC_BASE_PATH ?? ""
}
