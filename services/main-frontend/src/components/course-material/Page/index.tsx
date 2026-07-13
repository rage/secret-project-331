"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useAtomValue, useSetAtom } from "jotai"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useContext, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ClosedCourseWarningDialog from "../ClosedCourseWarningDialog"
import ContentRenderer from "../ContentRenderer"
import AudioPlayer from "../ContentRenderer/moocfi/AudioPlayer"
import NavigationContainer from "../ContentRenderer/moocfi/NavigationContainer"
import FeedbackHandler from "../FeedbackHandler"
import HeadingsNavigation from "../HeadingsNavigation"
import ReferenceList from "../ReferencesList"
import Chatbot from "../chatbot/Chatbot"
import SelectResearchConsentForm from "../forms/SelectResearchConsentForm"
import SelectUserInformationForm from "../forms/SelectUserInformationForm"
import AiUsageNoticeDialog from "../modals/AiUsageNoticeDialog"
import CourseSettingsModal from "../modals/CourseSettingsModal"
import UserOnWrongCourseNotification from "../notifications/UserOnWrongCourseNotification"

import type { GlossaryState } from "@/contexts/course-material/GlossaryContext"
import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"
import useAiUsageNoticeAcknowledgement from "@/hooks/course-material/useAiUsageNoticeAcknowledgement"
import useDefaultChatbotConfiguration from "@/hooks/course-material/useDefaultChatbotConfiguration"
import useDialogStep, { DialogStep } from "@/hooks/course-material/useDialogStep"
import useGlossary from "@/hooks/course-material/useGlossary"
import useHasCourseClosed from "@/hooks/course-material/useHasCourseClosed"
import usePageAudioFiles from "@/hooks/course-material/usePageAudioFiles"
import useResearchConsentForm from "@/hooks/course-material/useResearchConsentForm"
import useResearchConsentFormAnswers from "@/hooks/course-material/useResearchConsentFormAnswers"
import { useUserDetails } from "@/hooks/course-material/useUserDetails"
import AudioSpeaker from "@/img/course-material/audio-player/audio-speaker.svg"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { courseMaterialAtom } from "@/state/course-material"
import {
  isMaterialPageAtom,
  refetchViewAtom,
  viewIsFetchingAtom,
} from "@/state/course-material/selectors"
import { inlineColorStyles } from "@/styles/course-material/inlineColorStyles"
import type { Block } from "@/types/courseMaterialBlock"

interface Props {
  onRefresh: () => void
  organizationSlug: string
}

export interface AudioFile {
  path: string | undefined
  mime: string | undefined
}

const AudioNotification = styled.div`
  background: #f0eff9;
  padding: 1rem 1rem 1.4rem 1.2rem;

  p {
    color: ${baseTheme.colors.gray[600]};
    margin-bottom: 0.8rem;
  }
`

const Page: React.FC<React.PropsWithChildren<Props>> = ({ onRefresh, organizationSlug }) => {
  const [isVisible, setIsVisible] = useState(false)

  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const isMaterialPage = useAtomValue(isMaterialPageAtom)
  const viewIsFetching = useAtomValue(viewIsFetchingAtom)
  const triggerRefetch = useSetAtom(refetchViewAtom)
  const loginState = useContext(LoginStateContext)

  // Use refetch atom if onRefresh is not provided
  const handleRefresh =
    onRefresh ||
    (async () => {
      await triggerRefetch()
    })

  const courseId = courseMaterialState.page?.course_id
  const courseName = courseMaterialState.course?.name
  const pageId = courseMaterialState.page?.id
  const pageTitle = courseMaterialState.page?.title

  const tracks: AudioFile[] = []

  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showResearchConsentFormBecauseOfUrl, setShowResearchConsentFormBecauseOfUrl] =
    useState<boolean>(false)
  const [
    showResearchConsentFormBecauseOfMissingAnswers,
    setShowResearchConsentFormBecauseOfMissingAnswers,
  ] = useState<boolean>(false)
  const [shouldAnswerMissingInfoForm, setShouldAnswerMissingInfoForm] = useState<boolean>(false)
  const shouldChooseInstance =
    courseMaterialState.status === "ready" &&
    courseMaterialState.instance === null &&
    courseMaterialState.settings === null

  const [hasAnsweredForm, setHasAnsweredForm] = useState<boolean>(false)
  const researchFormQueryParam = searchParams.get("show_research_form")
  const waitingForCourseSettingsToBeFilled =
    courseMaterialState.settings?.current_course_instance_id === null ||
    courseMaterialState.settings?.current_course_instance_id === undefined

  const hasCourseClosed = useHasCourseClosed()

  useEffect(() => {
    if (researchFormQueryParam) {
      setShowResearchConsentFormBecauseOfUrl(true)
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.delete("show_research_form")
      const newUrl = `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ""}`
      router.replace(newUrl)
    }
  }, [router, researchFormQueryParam, searchParams])

  const researchConsentFormQuery = useResearchConsentForm(courseId)
  const researchConsentFormAnswerQuery = useResearchConsentFormAnswers(courseId)
  const chatbotConfiguration = useDefaultChatbotConfiguration(courseId)

  const userDetailsQuery = useUserDetails()

  const researchFormIsLoadedAndExists =
    researchConsentFormQuery.isSuccess && researchConsentFormQuery.data !== null

  // The hook only runs (and succeeds) for signed-in users with a courseId, so a successful `false`
  // result means a signed-in user who has not yet acknowledged the AI-usage notice. Enrollment is
  // not part of this gate.
  const aiUsageNoticeAcknowledgementQuery = useAiUsageNoticeAcknowledgement(courseId ?? null)
  const shouldShowAiUsageNotice =
    aiUsageNoticeAcknowledgementQuery.isSuccess && aiUsageNoticeAcknowledgementQuery.data === false

  const activeStep = useDialogStep({
    shouldAnswerMissingInfoForm,
    shouldChooseInstance,
    waitingForCourseSettingsToBeFilled,
    shouldShowAiUsageNotice,
    researchFormIsLoadedAndExists,
    showResearchConsentFormBecauseOfUrl,
    showResearchConsentFormBecauseOfMissingAnswers,
    hasAnsweredForm,
  })

  // Whether the logic above has finished deciding which dialog (if any) to show. This is exposed as a
  // data attribute (see the sentinel in the render below) so system tests can wait for a deterministic
  // signal instead of polling for dialogs that may still be appearing. It is `true` only once every
  // input to `useDialogStep` has settled and no page/exam (re)fetch is in flight that could still
  // change the answer. The query conditions mirror each hook's enable condition (`signedIn` /
  // `signedIn && courseId`) so a query that has just been enabled but not yet fetched does not count
  // as settled.
  const signedIn = loginState.signedIn === true
  const courseScopedQueriesShouldRun = signedIn && Boolean(courseId)
  const querySettled = (query: { isSuccess: boolean; isError: boolean }) =>
    query.isSuccess || query.isError
  const decisionReady =
    courseMaterialState.status !== "loading" &&
    !viewIsFetching &&
    (!signedIn || querySettled(userDetailsQuery)) &&
    (!courseScopedQueriesShouldRun ||
      (querySettled(aiUsageNoticeAcknowledgementQuery) &&
        querySettled(researchConsentFormQuery) &&
        querySettled(researchConsentFormAnswerQuery)))

  useMemo(() => {
    if (
      userDetailsQuery.data?.country === null ||
      userDetailsQuery.data?.first_name === null ||
      userDetailsQuery.data?.last_name === null
    ) {
      setShouldAnswerMissingInfoForm(true)
    }
  }, [
    userDetailsQuery.data?.country,
    userDetailsQuery.data?.first_name,
    userDetailsQuery.data?.last_name,
  ])

  useEffect(() => {
    if (
      researchConsentFormQuery.data !== null &&
      researchConsentFormAnswerQuery.data?.length === 0 &&
      !showResearchConsentFormBecauseOfMissingAnswers &&
      !hasAnsweredForm &&
      !waitingForCourseSettingsToBeFilled
    ) {
      setShowResearchConsentFormBecauseOfMissingAnswers(true)
    }
  }, [
    researchConsentFormAnswerQuery.data?.length,
    hasAnsweredForm,
    showResearchConsentFormBecauseOfMissingAnswers,
    researchConsentFormQuery.data,
    waitingForCourseSettingsToBeFilled,
  ])

  const getPageAudioFiles = usePageAudioFiles(pageId, courseId, isMaterialPage)

  // Fetch glossary for each page seperately
  const glossary = useGlossary(courseId, courseMaterialState.examData, isMaterialPage)

  if (glossary.isLoading) {
    return <Spinner variant={"small"} />
  }

  if (glossary.isError) {
    return <ErrorBanner variant={"readOnly"} error={glossary.error} />
  }
  const glossaryState: GlossaryState = { terms: glossary.data ?? [] }

  if (getPageAudioFiles.isLoading) {
    return <Spinner variant={"small"} />
  }

  if (getPageAudioFiles.isError) {
    return <ErrorBanner variant={"readOnly"} error={getPageAudioFiles.error} />
  }

  if (getPageAudioFiles.isSuccess) {
    getPageAudioFiles.data.map((item) => tracks.push({ path: item.path, mime: item.mime_type }))
  }

  return (
    <GlossaryContext.Provider value={glossaryState}>
      <>
        {/* Hidden sentinel exposing the dialog decision so system tests can wait deterministically.
            `data-dialogs-ready` flips to "true" once the decision has settled; `data-active-dialog`
            holds the currently shown DialogStep ("none" when no dialog is shown). */}
        <div
          data-testid="dialog-decision-state"
          data-dialogs-ready={decisionReady ? "true" : "false"}
          data-active-dialog={activeStep}
          hidden
        />
        {courseMaterialState.settings &&
          courseMaterialState.settings.current_course_instance_id !==
            courseMaterialState.instance?.id && (
            <UserOnWrongCourseNotification
              correctCourseId={courseMaterialState.settings?.current_course_id}
              organizationSlug={organizationSlug}
            />
          )}
        {courseId && activeStep === DialogStep.ChooseInstance && (
          <CourseSettingsModal
            onClose={() => {
              handleRefresh()
            }}
            shouldChooseInstance={true}
          />
        )}

        {courseId && courseMaterialState.course && activeStep === DialogStep.AiUsageNotice && (
          <AiUsageNoticeDialog
            courseId={courseId}
            aiPolicy={courseMaterialState.course.ai_policy}
            courseMaterialAiInstructions={
              courseMaterialState.course.course_material_ai_instructions
            }
            onClose={() => {
              handleRefresh()
            }}
          />
        )}

        {activeStep === DialogStep.ResearchConsent && (
          <SelectResearchConsentForm
            editForm={showResearchConsentFormBecauseOfUrl}
            shouldAnswerResearchForm={showResearchConsentFormBecauseOfMissingAnswers}
            usersInitialAnswers={researchConsentFormAnswerQuery.data}
            // oxlint-disable-next-line typescript/no-non-null-assertion -- activeStep is only ResearchConsent when researchFormIsLoadedAndExists, so data is non-null
            researchForm={researchConsentFormQuery.data!}
            onClose={() => {
              setShowResearchConsentFormBecauseOfUrl(false)
              setShowResearchConsentFormBecauseOfMissingAnswers(false)
              setHasAnsweredForm(true)
              if (showResearchConsentFormBecauseOfUrl) {
                router.back()
              }
            }}
          />
        )}

        {activeStep === DialogStep.MissingInfo && (
          <SelectUserInformationForm
            shouldAnswerMissingInfoForm={true}
            setShouldAnswerMissingInfoForm={setShouldAnswerMissingInfoForm}
            email={userDetailsQuery.data?.email ?? ""}
            firstName={userDetailsQuery.data?.first_name ?? ""}
            lastName={userDetailsQuery.data?.last_name ?? ""}
            country={userDetailsQuery.data?.country ?? null}
            emailCommunicationConsent={userDetailsQuery.data?.email_communication_consent ?? false}
          />
        )}
        {getPageAudioFiles.isSuccess && tracks.length > 0 && (
          <AudioNotification>
            <p>{t("audio-notification-description")}</p>
            <button
              onClick={() => setIsVisible(true)}
              className={css`
                height: 42px;
                width: auto;
                padding: 0 14px;
                border: none;
                background: rgba(101, 84, 192);
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 0 5px;

                cursor: pointer;
                filter: brightness(1) contrast(1);
                transition: filter 0.3s;

                &:hover {
                  filter: brightness(0.9) contrast(1.1);
                }
              `}
            >
              <AudioSpeaker />
              <span
                className={css`
                  color: #fff;
                `}
              >
                {t("open-audio-player-button")}
              </span>
            </button>
          </AudioNotification>
        )}

        {isMaterialPage && <HeadingsNavigation />}
        {hasCourseClosed && <ClosedCourseWarningDialog />}
        <div id="maincontent">
          {/* TODO: Better type for Page.content in bindings. */}
          <div id="content" className={inlineColorStyles}>
            <ContentRenderer
              data={(courseMaterialState.page?.content as Block<unknown>[]) ?? []}
              isExam={courseMaterialState.examData !== null}
              dontAllowBlockToBeWiderThanContainerWidth={false}
            />
          </div>
        </div>
        {courseMaterialState.page?.chapter_id && <NavigationContainer />}
        {courseMaterialState.page?.course_id && (
          <ReferenceList courseId={courseMaterialState.page.course_id} />
        )}
        {getPageAudioFiles.isSuccess && isVisible && tracks.length > 0 && (
          <AudioPlayer
            tracks={tracks}
            isVisible={isVisible}
            setIsVisible={() => setIsVisible(!isVisible)}
          />
        )}
        {courseId && pageId && (
          <>
            {chatbotConfiguration.data && (
              <Chatbot chatbotConfigurationId={chatbotConfiguration.data} />
            )}
            <FeedbackHandler
              courseId={courseId}
              courseName={courseName}
              courseHasChatbot={chatbotConfiguration.data != null}
              pageId={pageId}
              pageTitle={pageTitle}
            />
          </>
        )}
      </>
    </GlossaryContext.Provider>
  )
}

export default withErrorBoundary(withSuspenseBoundary(Page))
