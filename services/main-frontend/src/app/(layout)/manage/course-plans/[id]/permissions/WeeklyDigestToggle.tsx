"use client"

import { css } from "@emotion/css"
import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { setCourseDesignerWeeklyDigestSubscriptionMutation } from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Switch } from "@/shared-module/components"

const sectionStyles = css`
  margin-bottom: 2rem;
`

interface WeeklyDigestToggleProps {
  planId: string
  receivesWeeklyDigest: boolean
}

/** Lets the current member turn the plan's weekly progress email on or off for themselves. */
export default function WeeklyDigestToggle({
  planId,
  receivesWeeklyDigest,
}: WeeklyDigestToggleProps) {
  const { t } = useTranslation()
  const savedValueRef = useRef(receivesWeeklyDigest)
  const { control, setValue, watch } = useForm<{ receivesWeeklyDigest: boolean }>({
    defaultValues: { receivesWeeklyDigest },
  })

  const subscriptionMutation = useToastMutationOptions(
    setCourseDesignerWeeklyDigestSubscriptionMutation(),
    { notify: true, method: "PUT" },
    {
      onSuccess: (member) => {
        savedValueRef.current = member.receives_weekly_digest
      },
      onError: () => setValue("receivesWeeklyDigest", savedValueRef.current),
    },
  )
  const { mutate } = subscriptionMutation

  useEffect(() => {
    savedValueRef.current = receivesWeeklyDigest
    setValue("receivesWeeklyDigest", receivesWeeklyDigest)
  }, [receivesWeeklyDigest, setValue])

  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (
        name !== "receivesWeeklyDigest" ||
        values.receivesWeeklyDigest === undefined ||
        values.receivesWeeklyDigest === savedValueRef.current
      ) {
        return
      }
      mutate({
        path: { plan_id: planId },
        body: { receives_weekly_digest: values.receivesWeeklyDigest },
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, mutate, planId])

  return (
    <section className={sectionStyles}>
      <Switch
        id="course-plan-weekly-digest"
        name="receivesWeeklyDigest"
        control={control}
        label={t("course-plans-weekly-digest-label")}
        description={t("course-plans-weekly-digest-description")}
        isDisabled={subscriptionMutation.isPending}
      />
    </section>
  )
}
