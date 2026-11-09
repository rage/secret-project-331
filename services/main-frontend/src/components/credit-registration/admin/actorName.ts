import { formatUserName } from "@/hooks/useUserDetails"

import type { CreditRegistrationTFunction } from "../constants"

/** The admin who took an action, by name, else by email address. */
export const actorName = (
  t: CreditRegistrationTFunction,
  actor: {
    firstName: string | null | undefined
    lastName: string | null | undefined
    email: string | null | undefined
  },
): string =>
  formatUserName({ first_name: actor.firstName, last_name: actor.lastName }) ||
  actor.email ||
  t("missing-name")
