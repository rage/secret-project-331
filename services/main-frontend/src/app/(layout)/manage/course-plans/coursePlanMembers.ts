import type { PlanMemberWithDetails } from "@/generated/api/types.generated"

/** A plan member's full name, or their email when the profile has no name. */
export function formatPlanMemberName(
  member: Pick<PlanMemberWithDetails, "first_name" | "last_name" | "email">,
): string {
  const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
  return name.length > 0 ? name : member.email
}
