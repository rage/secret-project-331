import type { TFunction } from "i18next"

export function getOauthScopeDescriptions(t: TFunction): Record<string, string> {
  return {
    openid: t("oauth-scope-description-openid"),
    email: t("oauth-scope-description-email"),
    profile: t("oauth-scope-description-profile"),
    offline_access: t("oauth-scope-description-offline-access"),
    "exercise-services": t("oauth-scope-description-exercise-services"),
    "material:read": t("oauth-scope-description-material-read"),
    "material:stage": t("oauth-scope-description-material-stage"),
    "material:publish": t("oauth-scope-description-material-publish"),
    "settings:write": t("oauth-scope-description-settings-write"),
  }
}
