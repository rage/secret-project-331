"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { Infobox, Radio, RadioGroup, TransLink } from "@/shared-module/components"

import { CertificateHandoff } from "./CertificateHandoff"
import { SEGMENTED, SUOMI_FI_EIDAS_URL, SUOMI_FI_IDENTIFICATION_URL, TONE } from "./constants"
import { CreditJustificationForm } from "./CreditJustificationForm"
import { bandCss } from "./styles"

const HAS_FINNISH_ID_FIELD = "hasFinnishId"
const NEED_FIELD = "need"
const IDENTIFICATION_FIELD = "identification"
const NEED_AFTER_RECONSIDER_FIELD = "needAfterReconsider"

const YES = "yes"
const NO = "no"
const CERTIFICATE = "certificate"
const CREDITS = "credits"
const EIDAS = "eidas"
const OTHER_SUOMI_FI = "other_suomi_fi"
const NO_SUOMI_FI = "none"

/** These addresses are longer than a phone is wide, so they have to break mid-word. */
const addressCss = css`
  overflow-wrap: anywhere;
`

interface DetourForm {
  [HAS_FINNISH_ID_FIELD]: string
  [NEED_FIELD]: string
  [IDENTIFICATION_FIELD]: string
  [NEED_AFTER_RECONSIDER_FIELD]: string
}

export interface OpenUniversityDetourProps {
  courseModuleId: string
  /** The certificate the student can generate now; having one is what makes the detour worth asking. */
  certificateConfigurationId: string
  /** What the student wrote the last time they answered the last question, if they did. */
  creditJustification: string | null | undefined
  /** The Open University instructions every route through the detour ends at. */
  openUniversityContent: React.ReactNode
}

/**
 * The questions between "I am not a University of Helsinki student" and the Open University
 * instructions, for a module whose certificate would serve many of the students who land here.
 *
 * Registering credits means enrolling, enrolling means strong authentication, and a student
 * without a Finnish personal identity code or a Suomi.fi method pays for that in weeks of manual
 * identity checking. Every question exists to find the student a certificate serves instead, and
 * every one of them stays answerable: a changed answer only hides what is under it.
 */
export const OpenUniversityDetour: React.FC<OpenUniversityDetourProps> = ({
  courseModuleId,
  certificateConfigurationId,
  creditJustification,
  openUniversityContent,
}) => {
  // Default namespace, like the registration page these bands belong to, not the
  // `credit-registration` one the rest of this folder reads.
  const { t } = useTranslation()
  const { control, watch } = useForm<DetourForm>({
    defaultValues: {
      [HAS_FINNISH_ID_FIELD]: "",
      [NEED_FIELD]: "",
      [IDENTIFICATION_FIELD]: "",
      [NEED_AFTER_RECONSIDER_FIELD]: "",
    },
  })
  const [justificationSaved, setJustificationSaved] = useState(false)

  const hasFinnishId = watch(HAS_FINNISH_ID_FIELD)
  const need = watch(NEED_FIELD)
  const identification = watch(IDENTIFICATION_FIELD)
  const needAfterReconsider = watch(NEED_AFTER_RECONSIDER_FIELD)

  // Each band is conditioned on the one above it having led here, not on its own answer alone.
  // Answers survive an upstream change so a student who flips back finds their place, and without
  // the chain a stale answer would open a band under a branch that no longer reaches it.
  const asksWhichIsNeeded = hasFinnishId === NO
  const asksHowTheyIdentify = asksWhichIsNeeded && need === CREDITS
  const identifiesWithEidas = asksHowTheyIdentify && identification === EIDAS
  const identifiesWithAnotherSuomiFiMethod =
    asksHowTheyIdentify && identification === OTHER_SUOMI_FI
  const asksToReconsider = asksHowTheyIdentify && identification === NO_SUOMI_FI
  const asksWhyCreditsAreNeeded = asksToReconsider && needAfterReconsider === CREDITS
  const takesTheCertificate =
    (asksWhichIsNeeded && need === CERTIFICATE) ||
    (asksToReconsider && needAfterReconsider === CERTIFICATE)
  const justificationIsStored = justificationSaved || Boolean(creditJustification)
  const showsOpenUniversityContent =
    hasFinnishId === YES ||
    identifiesWithEidas ||
    identifiesWithAnotherSuomiFiMethod ||
    (asksWhyCreditsAreNeeded && justificationIsStored)

  return (
    <>
      <section className={bandCss}>
        <RadioGroup
          name={HAS_FINNISH_ID_FIELD}
          control={control}
          variant={SEGMENTED}
          label={t("are-you-finnish-or-do-you-have-a-finnish-personal-identity-code")}
        >
          <Radio value={YES} label={t("yes")} />
          <Radio value={NO} label={t("no")} />
        </RadioGroup>
      </section>

      {asksWhichIsNeeded ? (
        <section className={bandCss}>
          <RadioGroup
            name={NEED_FIELD}
            control={control}
            variant={SEGMENTED}
            label={t("which-do-you-need")}
            description={t("credits-in-uh-registry-are-useful-mainly-if-you-study-in-finland")}
          >
            <Radio value={CERTIFICATE} label={t("a-certificate-of-completion")} />
            <Radio value={CREDITS} label={t("credits-in-the-uh-study-registry")} />
          </RadioGroup>
        </section>
      ) : null}

      {takesTheCertificate ? (
        <CertificateHandoff
          courseModuleId={courseModuleId}
          certificateConfigurationId={certificateConfigurationId}
        />
      ) : null}

      {asksHowTheyIdentify ? (
        <section className={bandCss}>
          <RadioGroup
            name={IDENTIFICATION_FIELD}
            control={control}
            label={t("how-will-you-identify-yourself")}
            description={t("enrollment-requires-strong-authentication-choose-how-you-identify")}
          >
            {/* The address as text, not a link: an option's description sits inside its label, and
                a link there is both part of the radio's name and a second thing to click on it. The
                same address is a link in the tip the choice leads to. */}
            <Radio
              value={EIDAS}
              label={t("yes-with-eidas")}
              description={<span className={addressCss}>{SUOMI_FI_EIDAS_URL}</span>}
            />
            <Radio
              value={OTHER_SUOMI_FI}
              label={t("yes-with-another-suomi-fi-identification-method")}
              description={<span className={addressCss}>{SUOMI_FI_IDENTIFICATION_URL}</span>}
            />
            <Radio
              value={NO_SUOMI_FI}
              label={t("no")}
              description={t("choose-this-if-you-are-not-sure-which-option-applies-to-you")}
            />
          </RadioGroup>
        </section>
      ) : null}

      {identifiesWithEidas ? (
        <section className={bandCss}>
          <Infobox tone={TONE.INFO}>
            <Trans
              t={t}
              i18nKey="tip-in-sisu-choose-suomi-fi-e-identification-then-eidas"
              values={{ url: SUOMI_FI_EIDAS_URL }}
              components={{
                suomiFiLink: (
                  <TransLink
                    className={addressCss}
                    href={SUOMI_FI_EIDAS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </Infobox>
        </section>
      ) : null}

      {identifiesWithAnotherSuomiFiMethod ? (
        <section className={bandCss}>
          <Infobox tone={TONE.INFO}>
            <Trans
              t={t}
              i18nKey="tip-in-sisu-choose-suomi-fi-e-identification-then-your-method"
              values={{ url: SUOMI_FI_IDENTIFICATION_URL }}
              components={{
                suomiFiLink: (
                  <TransLink
                    className={addressCss}
                    href={SUOMI_FI_IDENTIFICATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </Infobox>
        </section>
      ) : null}

      {asksToReconsider ? (
        <section className={bandCss}>
          <RadioGroup
            name={NEED_AFTER_RECONSIDER_FIELD}
            control={control}
            variant={SEGMENTED}
            label={t("reconsider-which-do-you-need")}
            description={t("without-suomi-fi-identification-we-verify-your-identity-manually")}
          >
            <Radio value={CERTIFICATE} label={t("a-certificate-of-completion")} />
            <Radio value={CREDITS} label={t("credits-in-the-uh-study-registry")} />
          </RadioGroup>
        </section>
      ) : null}

      {asksWhyCreditsAreNeeded ? (
        <CreditJustificationForm
          courseModuleId={courseModuleId}
          savedJustification={creditJustification}
          onSaved={() => {
            setJustificationSaved(true)
          }}
        />
      ) : null}

      {showsOpenUniversityContent ? openUniversityContent : null}
    </>
  )
}
