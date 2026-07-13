import { useTranslation as useI18nTranslation } from "react-i18next"

type CmsTFunction = (key: string, options?: Record<string, unknown>) => string

interface CmsTranslationResult {
  t: CmsTFunction
  i18n: unknown
  ready: boolean
}

export function useTranslation(): CmsTranslationResult {
  const translation = useI18nTranslation("cms")

  return {
    t: translation.t as unknown as CmsTFunction,
    i18n: translation.i18n,
    ready: translation.ready,
  }
}
