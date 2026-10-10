"use client"

import { useQueryClient } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import InlineParts from "@/components/credit-registration/InlineParts"
import { getCreditRegistrationAttentionItemsQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { adminResendAccountLinkingEmail } from "@/generated/api/sdk.generated"
import type { AdminLinkingCandidate, AdminLinkingCourse } from "@/generated/api/types.generated"
import type { DialogAction } from "@/shared-module/components"
import { ComboBox, Dialog, Infobox, Radio, RadioGroup, TextField } from "@/shared-module/components"

import { BUTTON_PRIMARY, CREDIT_REGISTRATION_NS, TONE } from "../constants"
import { dialogFormCss, noteCss, proseCss } from "../styles"
import { useActionResult } from "../useActionResult"
import type { DialogOpenState } from "./AdminActionDialog"
import {
  useAccountLinkingCourses,
  useInvalidateAfterLinkingChange,
  useUnlinkedEnrolees,
} from "./adminCreditRegistrationHooks"
import {
  candidateFacts,
  candidateListCss,
  candidateName,
  ResendOutcomeNotice,
  showsNotEmailed,
} from "./linkingCandidate"

interface Fields {
  course_id: string | null
  filter: string
  student_number: string
}

const DEFAULT_FIELDS: Fields = { course_id: null, filter: "", student_number: "" }

const courseLabel = (course: AdminLinkingCourse) =>
  `${course.course_name} (${course.course_codes.join(", ")})`

const matchesFilter = (person: AdminLinkingCandidate, filter: string): boolean => {
  const needle = filter.trim().toLocaleLowerCase()
  const fullName = [person.first_names, person.last_name].filter(Boolean).join(" ")
  return [fullName, person.email, person.student_number]
    .join("\n")
    .toLocaleLowerCase()
    .includes(needle)
}

/**
 * Lets an admin send a linking email by hand to anyone on a course's enrolment lists who has no
 * linked account, whenever they enrolled, through the ordinary resend path.
 */
const AdminSendLinkingEmailDialog: React.FC<DialogOpenState> = ({ isOpen, onClose }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const { control, handleSubmit, watch, reset, setValue } = useForm<Fields>({
    defaultValues: DEFAULT_FIELDS,
  })
  const courseId = watch("course_id")
  const filter = watch("filter")
  const coursesQuery = useAccountLinkingCourses(isOpen)
  const enroleesQuery = useUnlinkedEnrolees(courseId, isOpen)

  useEffect(() => {
    setValue("filter", "")
    setValue("student_number", "")
  }, [courseId, setValue])

  const data = enroleesQuery.data
  const people = data?.people ?? []
  const shownPeople = people.filter((person) => matchesFilter(person, filter))
  const picked = shownPeople.find((person) => person.student_number === watch("student_number"))
  const isNotEmailedShown = showsNotEmailed(people)
  const course = coursesQuery.data?.find((one) => one.course_id === courseId)

  const { result, setResult, mutation } = useActionResult(
    (target: { student_number: string; course_id: string }) =>
      adminResendAccountLinkingEmail({
        body: {
          ...target,
          override_rate_caps: false,
          reason: null,
          credit_registration_id: null,
        },
      }),
    () => void enroleesQuery.refetch(),
  )

  const closeDialog = () => {
    onClose()
    reset(DEFAULT_FIELDS)
    if (result) {
      setResult(null)
      void Promise.all([
        invalidateAfterLinkingChange(),
        queryClient.invalidateQueries({ queryKey: getCreditRegistrationAttentionItemsQueryKey() }),
      ])
    }
  }

  const submit = handleSubmit((fields) => {
    if (fields.course_id && picked) {
      mutation.mutate({ student_number: picked.student_number, course_id: fields.course_id })
    }
  })
  const actions: readonly [DialogAction] = [
    {
      label: picked
        ? t("credit-registration-admin-linking-candidates-send-to", {
            name: candidateName(t, picked),
          })
        : t("button-text-send-linking-email"),
      variant: BUTTON_PRIMARY,
      isLoading: mutation.isPending,
      disabled: !picked,
      onPress: () => void submit(),
    },
  ]

  return (
    <Dialog
      open={isOpen}
      onClose={closeDialog}
      title={t("button-text-send-a-linking-email")}
      actions={actions}
    >
      <div className={dialogFormCss}>
        {result && !mutation.isPending && !mutation.isError && (
          <ResendOutcomeNotice result={result} />
        )}
        {mutation.isError && (
          <Infobox tone={TONE.DANGER} announce>
            {t("credit-registration-admin-send-linking-email-send-failed")}
          </Infobox>
        )}
        {coursesQuery.isError && (
          <Infobox tone={TONE.DANGER}>
            {t("credit-registration-admin-send-linking-email-courses-failed")}
          </Infobox>
        )}
        <ComboBox
          name="course_id"
          control={control}
          label={t("label-course")}
          placeholder={t("credit-registration-admin-send-linking-email-course-placeholder")}
          items={coursesQuery.data ?? []}
          getItemKey={(one) => one.course_id}
          getItemTextValue={courseLabel}
          isDisabled={coursesQuery.isPending}
        >
          {courseLabel}
        </ComboBox>
        {courseId && enroleesQuery.isError && (
          <Infobox tone={TONE.DANGER}>
            {t("credit-registration-admin-send-linking-email-enrolees-failed")}
          </Infobox>
        )}
        {courseId && enroleesQuery.isPending && (
          <p className={noteCss}>{t("credit-registration-admin-linking-candidates-loading")}</p>
        )}
        {data?.study_registry_unavailable && (
          <Infobox tone={TONE.WARNING}>
            {t("credit-registration-admin-linking-candidates-unavailable")}
          </Infobox>
        )}
        {data && !data.study_registry_unavailable && people.length === 0 && (
          <p className={proseCss}>{t("credit-registration-admin-send-linking-email-none")}</p>
        )}
        {data && course && people.length > 0 && (
          <>
            <p className={proseCss}>
              {t("credit-registration-admin-send-linking-email-intro", {
                codes: course.course_codes.join(", "),
              })}
            </p>
            <TextField
              name="filter"
              control={control}
              label={t("credit-registration-admin-send-linking-email-filter-label")}
              description={t("credit-registration-admin-send-linking-email-filter-description")}
            />
            {shownPeople.length === 0 ? (
              <p className={noteCss}>
                {t("credit-registration-admin-send-linking-email-no-match")}
              </p>
            ) : (
              <RadioGroup
                className={candidateListCss}
                name="student_number"
                control={control}
                label={t("credit-registration-admin-linking-candidates-label")}
                description={t("credit-registration-admin-send-linking-email-order")}
                isRequired
                rules={{ required: t("credit-registration-admin-linking-candidates-pick-one") }}
              >
                {shownPeople.map((person) => (
                  <Radio
                    key={person.student_number}
                    value={person.student_number}
                    label={candidateName(t, person)}
                    description={
                      <InlineParts parts={candidateFacts(t, person, isNotEmailedShown)} />
                    }
                  />
                ))}
              </RadioGroup>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}

export default AdminSendLinkingEmailDialog
