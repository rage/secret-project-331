export default function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}
