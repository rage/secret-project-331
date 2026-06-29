import { useMemo } from "react"

export enum DialogStep {
  None = "none",
  MissingInfo = "missing-info",
  ChooseInstance = "choose-instance",
  AiUsageNotice = "ai-usage-notice",
  ResearchConsent = "research-consent",
}

export interface DialogStepInputs {
  shouldAnswerMissingInfoForm: boolean
  shouldChooseInstance: boolean
  waitingForCourseSettingsToBeFilled: boolean

  // ai-usage notice related
  shouldShowAiUsageNotice: boolean

  // research-consent related
  researchFormIsLoadedAndExists: boolean
  showResearchConsentFormBecauseOfUrl: boolean
  showResearchConsentFormBecauseOfMissingAnswers: boolean
  hasAnsweredForm: boolean
}

/**
 * Returns exactly one active dialog step based on the required priority:
 * 1) Missing info -> 2) Select course instance -> 3) AI-usage notice -> 4) Research consent
 */
export default function useDialogStep({
  shouldAnswerMissingInfoForm,
  shouldChooseInstance,
  waitingForCourseSettingsToBeFilled,
  shouldShowAiUsageNotice,
  researchFormIsLoadedAndExists,
  showResearchConsentFormBecauseOfUrl,
  showResearchConsentFormBecauseOfMissingAnswers,
  hasAnsweredForm,
}: DialogStepInputs): DialogStep {
  const shouldShowResearchConsent =
    researchFormIsLoadedAndExists &&
    (showResearchConsentFormBecauseOfUrl || showResearchConsentFormBecauseOfMissingAnswers) &&
    !hasAnsweredForm

  return useMemo<DialogStep>(() => {
    if (shouldAnswerMissingInfoForm) {
      return DialogStep.MissingInfo
    }
    if (shouldChooseInstance || waitingForCourseSettingsToBeFilled) {
      return DialogStep.ChooseInstance
    }
    if (shouldShowAiUsageNotice) {
      return DialogStep.AiUsageNotice
    }
    if (shouldShowResearchConsent) {
      return DialogStep.ResearchConsent
    }
    return DialogStep.None
  }, [
    shouldAnswerMissingInfoForm,
    shouldChooseInstance,
    waitingForCourseSettingsToBeFilled,
    shouldShowAiUsageNotice,
    shouldShowResearchConsent,
  ])
}
