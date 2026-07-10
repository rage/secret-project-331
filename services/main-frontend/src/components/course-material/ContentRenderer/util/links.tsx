"use client"

import { useTranslation } from "react-i18next"

/**
 * Builds the `rel` for an anchor, appending the project's standard new-tab tokens
 * (noopener noreferrer) when the link opens in a new tab. Same-tab links keep their original rel.
 */
export const relForLinkTarget = (
  rel: string | undefined,
  linkTarget: string | undefined,
): string | undefined => {
  if (!linkTarget?.includes("_blank")) {
    return rel || undefined
  }
  // eslint-disable-next-line i18next/no-literal-string
  const tokens = new Set([...(rel?.split(/\s+/).filter(Boolean) ?? []), "noopener", "noreferrer"])
  return Array.from(tokens).join(" ")
}

/** Visually-hidden "opens in a new tab" hint, rendered only for links with target="_blank". */
export const OpensInNewTabNotice: React.FC<{ linkTarget: string | undefined }> = ({
  linkTarget,
}) => {
  const { t } = useTranslation()
  if (!linkTarget?.includes("_blank")) {
    return null
  }
  return <span className="screen-reader-only">{t("screen-reader-opens-in-new-tab")}</span>
}
