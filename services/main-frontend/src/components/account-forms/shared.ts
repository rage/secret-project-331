import { css } from "@emotion/css"
import type { TFunction } from "i18next"

import type {
  AccountFormAction,
  AccountFormListKind,
  AccountFormOutcome,
  AccountFormRule,
} from "@/generated/api/types.generated"

export const stackCss = css`
  display: grid;
  gap: var(--space-4);
`

export const toolbarCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
`

export const DENSITY_COMPACT = "compact" as const

export function actionLabel(t: TFunction, action: AccountFormAction): string {
  switch (action) {
    case "signup":
      return t("account-forms-action-signup")
    case "signup_code_resend":
      return t("account-forms-action-signup-code-resend")
    case "password_reset":
      return t("account-forms-action-password-reset")
    case "email_change":
      return t("account-forms-action-email-change")
  }
}

export const ACCOUNT_FORM_OUTCOMES: AccountFormOutcome[] = ["allow", "drop"]

export function outcomeLabel(t: TFunction, outcome: AccountFormOutcome): string {
  switch (outcome) {
    case "allow":
      return t("account-forms-outcome-allow")
    case "drop":
      return t("account-forms-outcome-drop")
  }
}

export const ACCOUNT_FORM_LIST_KINDS: AccountFormListKind[] = [
  "address",
  "mailbox",
  "account",
  "domain",
]

export function listKindLabel(t: TFunction, kind: AccountFormListKind): string {
  switch (kind) {
    case "address":
      return t("account-forms-list-kind-address")
    case "mailbox":
      return t("account-forms-list-kind-mailbox")
    case "account":
      return t("account-forms-list-kind-account")
    case "domain":
      return t("account-forms-list-kind-domain")
  }
}

/** What a rule matches by, in a few words. */
export function matcherSummary(
  t: TFunction,
  rule: Pick<AccountFormRule, "list_kind" | "list_entries">,
): string | null {
  if (!rule.list_kind) {
    return null
  }
  return t("account-forms-list-summary", {
    kind: listKindLabel(t, rule.list_kind),
    count: rule.list_entries.length,
  })
}

export function yesNo(t: TFunction, value: boolean): string {
  return value ? t("yes") : t("no")
}

export const codeCss = css`
  font-family: var(--font-mono, monospace);
  font-size: 0.85em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`
