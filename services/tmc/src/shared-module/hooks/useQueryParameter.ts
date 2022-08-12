import { useRouter } from "next/router"

export default function useQueryParameter(name: string): string {
  const router = useRouter()
  const value = router?.query[name]
  if (!value) {
    // use with dontRenderUntilQueryParametersReady
    return ""
  }
  if (value instanceof Array) {
    return value.join("/")
  }
  return value.toString()
}
