import { useRouter } from 'next/router'

export default function useQueryParameter(name: string): string | undefined {
  const router = useRouter()
  const value = router?.query[name]
  if (!value) {
    return undefined
  }
  return value.toString()
}
