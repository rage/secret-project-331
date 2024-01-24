import { useRouter } from "next/router"
import { useMemo } from "react"

export default function useQueryParameter(name: string): string {
  const router = useRouter()
  const routerReady = router.isReady
  const val = useMemo(() => {
    if (!routerReady) {
      return ""
    }
    const value = router?.query[name]
    if (!value) {
      // use with dontRenderUntilQueryParametersReady
      return ""
    }
    if (value instanceof Array) {
      return value.join("/")
    }
    return value.toString()
  }, [name, router?.query, routerReady])
  return val
}
