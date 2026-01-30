import { useSearchParams } from "next/navigation"
import { useMemo } from "react"

export default function useQueryParameter(name: string): string {
  const searchParams = useSearchParams()
  const val = useMemo(() => {
    const value = searchParams?.get(name)
    if (!value) {
      // use with dontRenderUntilQueryParametersReady
      return ""
    }
    return value
  }, [name, searchParams])
  return val
}
