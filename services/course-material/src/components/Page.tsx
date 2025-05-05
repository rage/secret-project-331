import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { GlossaryContext, GlossaryState } from "../contexts/GlossaryContext"
import PageContext from "../contexts/PageContext"
import useSelectedBlockId from "../hooks/useSelectedBlockId"
import {
  Block,
  fetchGlossary,
  fetchPageAudioFiles,
  fetchResearchFormAnswersWithUserId,
  fetchResearchFormWithCourseId,
  getChatbotConfigurationForCourse,
} from "../services/backend"
import { inlineColorStyles } from "../styles/inlineColorStyles"

import AudioSpeaker from "./../img/audio-player/audio-speaker.svg"
import ContentRenderer from "./ContentRenderer"
import AudioPlayer from "./ContentRenderer/moocfi/AudioPlayer"
import NavigationContainer from "./ContentRenderer/moocfi/NavigationContainer"
import FeedbackHandler from "./FeedbackHandler"
import HeadingsNavigation from "./HeadingsNavigation"
import ReferenceList from "./ReferencesList"
import Chatbot from "./chatbot"
import SelectResearchConsentForm from "./forms/SelectResearchConsentForm"
import SelectUserCountryForm from "./forms/SelectUserCountryForm"
import CourseSettingsModal from "./modals/CourseSettingsModal"
import UserOnWrongCourseNotification from "./notifications/UserOnWrongCourseNotification"

import { useUserDetails } from "@/hooks/useUserDetails"
import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import { baseTheme } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
  // block id -> new block contents
  const [edits, setEdits] = useState<Map<string, NewProposedBlockEdit>>(new Map())
  const pageContext = useContext(PageContext)
  const [editingMaterial, setEditingMaterial] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const courseId = pageContext?.pageData?.course_id
  const pageId = pageContext?.pageData?.id
  const isMaterialPage = pageContext.pageData?.content && Boolean(pageContext.pageData?.chapter_id)
  const [selectedBlockId, clearSelectedBlockId] = useSelectedBlockId()

  const tracks: AudioFile[] = []

  const { t } = useTranslation()
  const router = useRouter()

  const [showResearchConsentForm, setShowResearchConsentForm] = useState<boolean>(false)
  const [shouldAnswerResearchForm, setShouldAnswerResearchForm] = useState<boolean>(false)
  const [shouldAnswerMissingInfoForm, setShouldAnswerMissingInfoForm] = useState<boolean>(false)

  const [hasAnsweredForm, setHasAnsweredForm] = useState<boolean>(false)
  const researchFormQueryParam = useQueryParameter("show_research_form")
  const loginContext = useContext(LoginStateContext)
  const waitingForCourseSettingsToBeFilled =
    pageContext.settings?.current_course_instance_id === null ||
    pageContext.settings?.current_course_instance_id === undefined

  useEffect(() => {
    if (researchFormQueryParam) {
      setShowResearchConsentForm(true)
      const newPathObject = {
        ...router,
      }

      delete newPathObject.query.show_research_form

      router.replace(newPathObject, undefined, { shallow: true })
    }
  }, [router, researchFormQueryParam])

  const researchConsentFormQuery = useQuery({
    queryKey: [`courses-${courseId}-research-consent-form`],
    queryFn: () => fetchResearchFormWithCourseId(assertNotNullOrUndefined(courseId)),
    enabled: loginContext.signedIn === true && Boolean(courseId),
  })

  const researchConsentFormAnswerQuery = useQuery({
    queryKey: [`courses-${courseId}-research-consent-form-user-answer`],
    queryFn: () => fetchResearchFormAnswersWithUserId(assertNotNullOrUndefined(courseId)),
    enabled: loginContext.signedIn === true && Boolean(courseId),
  })

  const chatbotConfiguration = useQuery({
    queryKey: [`courses-${courseId}-chatbot-configuration`],
    queryFn: () => getChatbotConfigurationForCourse(assertNotNullOrUndefined(courseId)),
    enabled: loginContext.signedIn === true && Boolean(courseId),
  })

  const userDetailsQuery = useUserDetails()

  useEffect(() => {
    if (
      userDetailsQuery.data?.country === null ||
      userDetailsQuery.data?.first_name === null ||
      userDetailsQuery.data?.last_name
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
      !shouldAnswerResearchForm &&
      !hasAnsweredForm &&
      !waitingForCourseSettingsToBeFilled
    ) {
      setShouldAnswerResearchForm(true)
    }
  }, [
    researchConsentFormAnswerQuery.data?.length,
    hasAnsweredForm,
    shouldAnswerResearchForm,
    researchConsentFormQuery.data,
    waitingForCourseSettingsToBeFilled,
  ])

  const getPageAudioFiles = useQuery({
    queryKey: [`page-${pageId}-audio-files`, courseId, isMaterialPage],
    queryFn: () => (courseId && isMaterialPage && pageId ? fetchPageAudioFiles(pageId) : []),
  })

  // Fetch glossary for each page seperately
  const glossary = useQuery({
    queryKey: [`glossary-${courseId}`, pageContext.exam, isMaterialPage],
    queryFn: () =>
      courseId && pageContext.exam === null && isMaterialPage ? fetchGlossary(courseId) : [],
  })

  if (glossary.isPending) {
    return <Spinner variant={"small"} />
  }

  if (glossary.isError) {
    return <ErrorBanner variant={"readOnly"} error={glossary.error} />
  }
  const glossaryState: GlossaryState = { terms: glossary.data }

  if (getPageAudioFiles.isPending) {
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
        {pageContext.settings &&
          pageContext.settings.current_course_instance_id !== pageContext.instance?.id && (
            <UserOnWrongCourseNotification
              correctCourseId={pageContext.settings?.current_course_id}
              organizationSlug={organizationSlug}
            />
          )}
        {courseId && (
          <CourseSettingsModal
            onClose={() => {
              onRefresh()
            }}
          />
        )}
        {researchConsentFormQuery.isSuccess &&
          researchConsentFormQuery.data !== null &&
          (showResearchConsentForm || shouldAnswerResearchForm) && (
            <SelectResearchConsentForm
              editForm={showResearchConsentForm}
              shouldAnswerResearchForm={shouldAnswerResearchForm}
              usersInitialAnswers={researchConsentFormAnswerQuery.data}
              researchForm={researchConsentFormQuery.data}
              onClose={() => {
                setShowResearchConsentForm(false)
                setShouldAnswerResearchForm(false)
                setHasAnsweredForm(true)
                if (showResearchConsentForm) {
                  router.back()
                }
              }}
            />
          )}
        {shouldAnswerMissingInfoForm && (
          <SelectUserCountryForm
            shouldAnswerMissingInfoForm={shouldAnswerMissingInfoForm}
            setShouldAnswerMissingInfoForm={setShouldAnswerMissingInfoForm}
            firstName={userDetailsQuery.data?.first_name ?? ""}
            lastName={userDetailsQuery.data?.last_name ?? ""}
            country={userDetailsQuery.data?.country ?? null}
          />
        )}
        {getPageAudioFiles.isSuccess && tracks.length !== 0 && (
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
        <div id="maincontent">
          {/* TODO: Better type for Page.content in bindings. */}
          <div id="content" className={inlineColorStyles}>
            <ContentRenderer
              data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []}
              editing={editingMaterial}
              selectedBlockId={selectedBlockId}
              setEdits={setEdits}
              isExam={pageContext.exam !== null}
              dontAllowBlockToBeWiderThanContainerWidth={false}
            />
          </div>
        </div>
        {pageContext.pageData?.chapter_id && <NavigationContainer />}
        {pageContext.pageData?.course_id && (
          <ReferenceList courseId={pageContext.pageData.course_id} />
        )}
        {getPageAudioFiles.isSuccess && isVisible && tracks.length !== 0 && (
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
              pageId={pageId}
              onEnterEditProposalMode={() => {
                setEditingMaterial(true)
              }}
              onExitEditProposalMode={() => {
                setEditingMaterial(false)
                setEdits(new Map())
              }}
              selectedBlockId={selectedBlockId}
              clearSelectedBlockId={clearSelectedBlockId}
              edits={edits}
            />
          </>
        )}
      </>
    </GlossaryContext.Provider>
  )
}

export default withErrorBoundary(Page)
