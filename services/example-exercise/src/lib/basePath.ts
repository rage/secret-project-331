/** Base path the service is mounted under, configured through the `NEXT_PUBLIC_BASE_PATH` env. */
export default function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}
