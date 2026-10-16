import { createI18n } from "@/shared-module/exercise-react/react/i18n/createI18n"

/** Languages with files under `src/locales/`; any other language falls back to English. */
const LOCALE_LANGUAGES: ReadonlySet<string> = new Set(["en", "fi"])

/**
 * Initialises i18next for this exercise service. The i18next configuration is shared from the
 * exercise-react package; only the translation loading stays here, because the locale files live
 * in this service's local `src/locales` directory (the dynamic import is resolved relative to this
 * file, so the bundle only ever contains the active language).
 *
 * The host sends any BCP 47 tag (`en-US`, `sv`). A language loads by its primary subtag, and one
 * without locale files loads no strings, so i18next shows English instead of failing the load.
 */
const initI18n = (defaultNS: string) =>
  createI18n(defaultNS, (language, namespace) => {
    const primarySubtag = language.toLowerCase().split(/[-_]/)[0] ?? ""
    return LOCALE_LANGUAGES.has(primarySubtag)
      ? import(`../locales/${primarySubtag}/${namespace}.json`).then(
          // Hyphenated keys aren't named exports of a JSON module, only properties of its default.
          (module: { default: Record<string, string> }) => module.default,
        )
      : Promise.resolve({})
  })

export default initI18n
