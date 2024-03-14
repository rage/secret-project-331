import { useMemo } from "react"

export interface UseParsedPrivateSpecResult {
  parsedPrivateSpec: unknown
  privateSpecValidJson: boolean
  rawPrivateSpec: string
}

const useParsedPrivateSpec = (privateSpec: string): UseParsedPrivateSpecResult => {
  return useMemo(() => {
    let privateSpecValidJson = false
    let parsedPrivateSpec: unknown = null

    try {
      parsedPrivateSpec = JSON.parse(privateSpec)
      privateSpecValidJson = true
    } catch (e) {
      console.warn("Private spec was invalid JSON", e)
    }
    return {
      privateSpecValidJson,
      parsedPrivateSpec,
      rawPrivateSpec: privateSpec,
    }
  }, [privateSpec])
}

export default useParsedPrivateSpec
