/**
 * Base path the service is mounted under, configured through the `PUBLIC_BASE_PATH` env.
 *
 * rsbuild inlines `import.meta.env.PUBLIC_*` into both the client and the server bundle at build
 * time, so this resolves to the value the production Dockerfile exports before `rsbuild build`.
 */
export default function basePath(): string {
  return import.meta.env.PUBLIC_BASE_PATH ?? ""
}
