"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import CompletionRegistrationPage from "@/app/(layout)/completion-registration/[courseModuleId]/CompletionRegistrationPage"
import { CREDIT_REGISTRATION_NS, TONE } from "@/components/credit-registration/constants"
import { narrowPageCss } from "@/components/credit-registration/styles"
import { client } from "@/generated/api/client.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { Dialog, Infobox, Select, Switch } from "@/shared-module/components"

import {
  buildDemoState,
  DEMO_COURSE_MODULE_ID,
  DEMO_STAGES,
  type DemoStage,
  type DemoVariants,
  isStudentNumberLinkedIn,
  studentNumberRuleOf,
} from "./demoData"
import { createDemoFetch, DEMO_QUERY_IDS } from "./demoServer"

const STAGE_FIELD = "stage"
const LINKED_FIELD = "isStudentNumberLinked"
const CERTIFICATE_FIELD = "hasCertificate"
const LANGUAGE_FIELD = "language"

const LANGUAGES = [
  { value: "fi", labelKey: "finnish" },
  { value: "en", labelKey: "english" },
] as const

interface PickerForm extends DemoVariants {
  [LANGUAGE_FIELD]: string
}

const STAGE_LABEL_KEYS = {
  starting: "credit-registration-demo-stage-starting",
  asks_where_enrolled: "credit-registration-demo-stage-asks-where-enrolled",
  enrolment_confirmed: "credit-registration-demo-stage-enrolment-confirmed",
  linking_email_sent: "credit-registration-demo-stage-linking-email-sent",
  waiting_for_course_setup: "credit-registration-demo-stage-waiting-for-course-setup",
  sending: "credit-registration-demo-stage-sending",
  waiting_for_sisu: "credit-registration-demo-stage-waiting-for-sisu",
  processing_in_sisu: "credit-registration-demo-stage-processing-in-sisu",
  registered: "credit-registration-demo-stage-registered",
  failed: "credit-registration-demo-stage-failed",
  not_registering: "credit-registration-demo-stage-not-registering",
} as const satisfies Record<DemoStage, string>

const pickerCss = css`
  display: grid;
  gap: var(--space-4);
`

/** Drops the fake answers from the cache, so neither a new variant nor a real page reads them. */
const isDemoQuery = (queryKey: readonly unknown[]): boolean => {
  const first = queryKey[0]
  return (
    typeof first === "object" &&
    first !== null &&
    "_id" in first &&
    typeof first._id === "string" &&
    DEMO_QUERY_IDS.has(first._id)
  )
}

/**
 * The student's credit registration page drawn from made-up data, for showing people what it says
 * in each situation. The page's own code runs unchanged: while this is mounted the API client's
 * `fetch` answers its requests from a fake server, so its buttons work and nothing is saved.
 */
const CreditRegistrationDemo: React.FC = () => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  usePageTitle(t("credit-registration-demo-page-title"))
  const queryClient = useQueryClient()
  const [isIntroOpen, setIsIntroOpen] = useState(true)
  const { control, watch, setValue } = useForm<PickerForm>({
    defaultValues: {
      [STAGE_FIELD]: "asks_where_enrolled",
      [LINKED_FIELD]: false,
      [CERTIFICATE_FIELD]: true,
      [LANGUAGE_FIELD]: i18n.language.startsWith("fi") ? "fi" : "en",
    },
  })
  const stage = watch(STAGE_FIELD)
  const isStudentNumberLinked = watch(LINKED_FIELD)
  const hasCertificate = watch(CERTIFICATE_FIELD)
  const language = watch(LANGUAGE_FIELD)
  const studentNumberRule = studentNumberRuleOf(stage)

  // One fake server per variant: picking another starts from that situation afresh.
  const variantKey = `${stage}:${isStudentNumberLinked}:${hasCertificate}`
  const demoState = useMemo(
    () => buildDemoState({ stage, isStudentNumberLinked, hasCertificate }, Date.now()),
    [stage, isStudentNumberLinked, hasCertificate],
  )
  const [installedState, setInstalledState] = useState<typeof demoState | null>(null)

  // Layout effect so the fake fetch is in place before the page below mounts and queries.
  useLayoutEffect(() => {
    const realFetch = client.getConfig().fetch ?? globalThis.fetch
    client.setConfig({ fetch: createDemoFetch(demoState, realFetch) as typeof fetch })
    queryClient.removeQueries({ predicate: (query) => isDemoQuery(query.queryKey) })
    setInstalledState(demoState)
    return () => {
      client.setConfig({ fetch: realFetch })
      queryClient.removeQueries({ predicate: (query) => isDemoQuery(query.queryKey) })
    }
  }, [demoState, queryClient])

  useEffect(() => {
    if (!i18n.language.startsWith(language)) {
      void i18n.changeLanguage(language)
    }
  }, [i18n, language])

  // A stage that fixes the number shows the switch the way the stage has it.
  useEffect(() => {
    if (studentNumberRule !== "either") {
      setValue(
        LINKED_FIELD,
        isStudentNumberLinkedIn({ stage, isStudentNumberLinked, hasCertificate }),
      )
    }
  }, [hasCertificate, isStudentNumberLinked, setValue, stage, studentNumberRule])

  return (
    <>
      <div className={narrowPageCss}>
        <Infobox tone={TONE.WARNING} heading={t("credit-registration-demo-banner-heading")}>
          <p>{t("credit-registration-demo-banner")}</p>
          <form className={pickerCss} onSubmit={(event) => event.preventDefault()}>
            <Select
              name={STAGE_FIELD}
              control={control}
              label={t("credit-registration-demo-stage")}
              options={DEMO_STAGES.map((value) => ({ value, label: t(STAGE_LABEL_KEYS[value]) }))}
            />
            <Switch
              name={LINKED_FIELD}
              control={control}
              label={t("credit-registration-demo-student-number-linked")}
              description={
                studentNumberRule === "either"
                  ? undefined
                  : t("credit-registration-demo-student-number-fixed")
              }
              isDisabled={studentNumberRule !== "either"}
            />
            <Switch
              name={CERTIFICATE_FIELD}
              control={control}
              label={t("credit-registration-demo-certificate")}
              description={t("credit-registration-demo-certificate-description")}
            />
            <Select
              name={LANGUAGE_FIELD}
              control={control}
              label={t("credit-registration-demo-language")}
              options={LANGUAGES.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            />
          </form>
        </Infobox>
      </div>
      {installedState === demoState ? (
        <CompletionRegistrationPage key={variantKey} courseModuleId={DEMO_COURSE_MODULE_ID} />
      ) : null}
      <Dialog
        open={isIntroOpen}
        onClose={() => setIsIntroOpen(false)}
        title={t("credit-registration-demo-dialog-title")}
        actions={[
          {
            label: t("credit-registration-demo-dialog-close"),
            variant: "primary",
            onPress: () => setIsIntroOpen(false),
          },
        ]}
      >
        <p>{t("credit-registration-demo-dialog-body")}</p>
      </Dialog>
    </>
  )
}

export default CreditRegistrationDemo
