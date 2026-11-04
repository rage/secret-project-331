"use client"

import { useTranslation } from "react-i18next"

import type { EntityRef } from "@/generated/api/types.generated"

/** Names an entity as people call it; the server leaves the default module's and course default review config's labels empty. */
export function useEntityName() {
  const { t } = useTranslation()
  return (entity: EntityRef): string => {
    if (entity.label !== "") {
      return entity.label
    }
    switch (entity.entity_type) {
      case "module":
        return t("default-module")
      case "course_default_review_config":
        return t("agent-entity-course-default-review-config")
      default:
        return entity.label
    }
  }
}
