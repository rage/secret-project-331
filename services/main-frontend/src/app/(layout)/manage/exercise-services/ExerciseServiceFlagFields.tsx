"use client"

import { css } from "@emotion/css"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ExerciseServiceNewOrUpdate } from "@/generated/api/types.generated"
import { Checkbox } from "@/shared-module/components"

export type ExerciseServiceFlags = Pick<
  ExerciseServiceNewOrUpdate,
  "is_global_admin_only" | "is_experimental"
>

const fieldsCss = css`
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
`

interface ExerciseServiceFlagFieldsProps {
  flags: ExerciseServiceFlags
  onChange: (flags: ExerciseServiceFlags) => void
}

/** Checkboxes for the admin-set flags of an exercise service. */
const ExerciseServiceFlagFields: React.FC<ExerciseServiceFlagFieldsProps> = ({
  flags,
  onChange,
}) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ExerciseServiceFlags>({ defaultValues: flags })
  const isGlobalAdminOnly = watch("is_global_admin_only")
  const isExperimental = watch("is_experimental")

  useEffect(() => {
    if (
      isGlobalAdminOnly !== flags.is_global_admin_only ||
      isExperimental !== flags.is_experimental
    ) {
      onChange({ is_global_admin_only: isGlobalAdminOnly, is_experimental: isExperimental })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdminOnly, isExperimental])

  return (
    <div className={fieldsCss}>
      <Checkbox
        name="is_global_admin_only"
        control={control}
        label={t("label-only-global-admins-can-add-to-courses")}
      />
      <Checkbox name="is_experimental" control={control} label={t("label-experimental")} />
    </div>
  )
}

export default ExerciseServiceFlagFields
