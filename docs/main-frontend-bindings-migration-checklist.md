# Main Frontend Bindings Migration Checklist

Rules:

- One checklist item per file that still imports `@/shared-module/common/bindings` and/or `@/shared-module/common/bindings.guard`.
- Do not mark a file done until API-derived `bindings` imports are replaced with generated Hey API types, API-derived `bindings.guard` imports are removed, and `cd services/main-frontend && pnpm exec tsc --noEmit` passes for the current batch.
- If a file still needs a non-API `bindings` symbol after cleanup, leave a short note inline when marking it done.

Total files: 267

## Hooks

- [x] `services/main-frontend/src/components/course-material/ContentRenderer/core/common/Paragraph/proposing-edits/hooks/useParagraphEditing.ts`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/hooks/useChatbotStateAndData.ts`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/hooks/useSynchronizeDefaultChatbotCommunicationChannel.tsx`
- [x] `services/main-frontend/src/hooks/count/useUnreadFeedbackCount.tsx`
- [x] `services/main-frontend/src/hooks/course-material/chatbot/newConversationMutation.tsx`
- [x] `services/main-frontend/src/hooks/course-material/chatbot/useCurrentConversationInfo.ts`
- [x] `services/main-frontend/src/hooks/course-material/useCourseInstances.tsx`
- [x] `services/main-frontend/src/hooks/course-material/useCourseMaterialExerciseQuery.tsx`
- [x] `services/main-frontend/src/hooks/course-material/useResearchConsentForm.tsx`
- [x] `services/main-frontend/src/hooks/course-material/useResearchConsentFormAnswers.tsx`
- [x] `services/main-frontend/src/hooks/course-material/useUserChapterLocks.ts`
- [x] `services/main-frontend/src/hooks/course-material/useUserModuleCompletions.tsx`
- [x] `services/main-frontend/src/hooks/globalStats.tsx`
- [x] `services/main-frontend/src/hooks/playground/usePlaygroundQueriesAndMutations.tsx`
- [x] `services/main-frontend/src/hooks/stats.tsx`
- [x] `services/main-frontend/src/hooks/useAllOrganizationsQuery.tsx`
- [x] `services/main-frontend/src/hooks/useAuthorizedClientsQuery.ts`
- [x] `services/main-frontend/src/hooks/useCourseBreadcrumbInfoQuery.tsx`
- [x] `services/main-frontend/src/hooks/useCourseExercisesAndCountAnswersRequitingAttentionQuery.tsx`
- [x] `services/main-frontend/src/hooks/useCourseIdFromExerciseStatus.ts`
- [x] `services/main-frontend/src/hooks/useCourseInstanceProgress.ts`
- [x] `services/main-frontend/src/hooks/useCourseInstancesQuery.tsx`
- [x] `services/main-frontend/src/hooks/useCourseLanguageVersions.tsx`
- [x] `services/main-frontend/src/hooks/useCourseModuleCompletions.ts`
- [x] `services/main-frontend/src/hooks/useCoursePageVisitDatumSummary.tsx`
- [x] `services/main-frontend/src/hooks/useCourseQuery.tsx`
- [x] `services/main-frontend/src/hooks/useCourseStructure.tsx`
- [x] `services/main-frontend/src/hooks/useCreateCourse.tsx`
- [x] `services/main-frontend/src/hooks/useExamSubmissionsInfo.tsx`
- [x] `services/main-frontend/src/hooks/useExeciseQuery.tsx`
- [x] `services/main-frontend/src/hooks/useExerciseStatusSummaries.ts`
- [x] `services/main-frontend/src/hooks/useExerciseSubmissionsForUser.tsx`
- [x] `services/main-frontend/src/hooks/useExercises.tsx`
- [x] `services/main-frontend/src/hooks/useOrganizationCourseCount.tsx`
- [x] `services/main-frontend/src/hooks/useOrganizationCourses.tsx`
- [x] `services/main-frontend/src/hooks/useOrganizationDuplicatableCourses.tsx`
- [x] `services/main-frontend/src/hooks/useOrganizationQueryBySlug.tsx`
- [x] `services/main-frontend/src/hooks/usePageInfo.tsx`
- [x] `services/main-frontend/src/hooks/useStatusCronJobs.tsx`
- [x] `services/main-frontend/src/hooks/useStatusDeployments.tsx`
- [x] `services/main-frontend/src/hooks/useStatusEvents.tsx`
- [x] `services/main-frontend/src/hooks/useStatusIngresses.tsx`
- [x] `services/main-frontend/src/hooks/useStatusJobs.tsx`
- [x] `services/main-frontend/src/hooks/useStatusPodDisruptionBudgets.tsx`
- [x] `services/main-frontend/src/hooks/useStatusPods.tsx`
- [x] `services/main-frontend/src/hooks/useStatusServices.tsx`
- [x] `services/main-frontend/src/hooks/useSystemHealthDetailed.tsx`
- [x] `services/main-frontend/src/hooks/useUserCourseProgress.ts`
- [x] `services/main-frontend/src/hooks/useUserCourseSettings.tsx`
- [x] `services/main-frontend/src/hooks/useUserDetails.ts`
- [x] `services/main-frontend/src/hooks/useUserDetailsForUserQuery.tsx`
- [x] `services/main-frontend/src/hooks/useUserResearchConsentQuery.tsx`
- [x] `services/main-frontend/src/hooks/useUsers.tsx`

## State

- [x] `services/main-frontend/src/state/course-material/index.ts`
- [x] `services/main-frontend/src/state/course-material/params.ts`
- [x] `services/main-frontend/src/state/course-material/queries.ts`
- [x] `services/main-frontend/src/state/course-material/selectors.ts`

## Components

- [x] `services/main-frontend/src/components/Layout.tsx`
- [x] `services/main-frontend/src/components/MainFrontedViewSubmission.tsx`
- [x] `services/main-frontend/src/components/NewCourseForm/DuplicateOptions.tsx`
- [x] `services/main-frontend/src/components/NewCourseForm/LanguageVersionOptions.tsx`
- [x] `services/main-frontend/src/components/NewCourseForm/index.tsx`
- [x] `services/main-frontend/src/components/PermissionPage.tsx`
- [x] `services/main-frontend/src/components/Topbar/SearchButton.tsx`
- [x] `services/main-frontend/src/components/UserDisplay/UserDetailsContent.tsx`
- [x] `services/main-frontend/src/components/forms/AddCompletionsForm.tsx`
- [x] `services/main-frontend/src/components/forms/EditExamForm.tsx`
- [x] `services/main-frontend/src/components/forms/EditReferenceForm.tsx`
- [x] `services/main-frontend/src/components/forms/EditUserInformationForm.tsx`
- [x] `services/main-frontend/src/components/forms/GradeExamAnswerForm.tsx`
- [x] `services/main-frontend/src/components/forms/NewExamForm.tsx`
- [x] `services/main-frontend/src/components/forms/NewReferenceForm.tsx`
- [x] `services/main-frontend/src/components/forms/ResearchOnCoursesForm.tsx`

## Course Material Components

- [x] `services/main-frontend/src/components/course-material/ContentRenderer/core/common/GlossaryTooltip/index.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/core/common/Paragraph/proposing-edits/EditableParagraph.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/core/common/Paragraph/proposing-edits/PreviewableParagraph.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/core/embeds/variants/MentimeterEmbedBlock.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ChapterProgressBlock/ChapterProgress.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CodeGiveAway/index.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ConditionalBlock.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CongratulationsBlock/Congratulations.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CongratulationsBlock/CongratulationsLinks.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CongratulationsBlock/ModuleCard.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CourseChapterGridBlock/ChapterGrid.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CourseChapterGridBlock/ChapterGridCard.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CourseChapterGridBlock/Grid.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CourseChapterGridBlock/StyledCard.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CourseProgressBlock/CourseProgress.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/CourseProgressBlock/index.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/ExerciseStatusMessage.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/ExerciseTask.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/PeerOrSelfReviewView/PeerOrSelfReviewQuestion/index.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/PeerOrSelfReviewView/PeerOrSelfReviewViewImpl.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/PeerOrSelfReviewView/PeerOrSelfReviewsReceivedComponent/ReceivedPeerOrSelfReview.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/PeerOrSelfReviewView/PeerOrSelfReviewsReceivedComponent/index.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/PeerOrSelfReviewView/WaitingForPeerReviews.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/index.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseCustomViewBlock/CustomViewIframe.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseInChapterBlock/ChapterExerciseListGroupedByPage.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseInChapterBlock/ExercisesInChapter.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/NavigationContainer/NextPage.tsx`
- [x] `services/main-frontend/src/components/course-material/ContentRenderer/util/textParsing.tsx`
- [x] `services/main-frontend/src/components/course-material/EditProposalDialog.tsx`
- [x] `services/main-frontend/src/components/course-material/FeedbackDialog.tsx`
- [x] `services/main-frontend/src/components/course-material/SearchDialog.tsx`
- [x] `services/main-frontend/src/components/course-material/chatbot/__tests__/MessageBubble.test.ts`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/ChatbotChatBody.tsx`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/ChatbotChatHeader.tsx`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/ChatbotReferenceList.tsx`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/CitationPopover.tsx`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/CitationPopovers.tsx`
- [x] `services/main-frontend/src/components/course-material/chatbot/shared/MessageBubble.tsx`
- [x] `services/main-frontend/src/components/course-material/forms/SelectCourseInstanceForm.tsx`
- [x] `services/main-frontend/src/components/course-material/forms/SelectResearchConsentForm.tsx`
- [x] `services/main-frontend/src/components/course-material/layout/Layout.tsx`
- [x] `services/main-frontend/src/components/course-material/layout/PartnersSection.tsx`
- [x] `services/main-frontend/src/components/course-material/modals/CourseSettingsModal.tsx`
- [x] `services/main-frontend/src/components/course-material/navigation/CourseMaterialPageBreadcrumbs.tsx`

## Manage App

- [x] `services/main-frontend/src/app/manage/chatbots/[id]/[...path]/page.tsx`
- [x] `services/main-frontend/src/app/manage/chatbots/[id]/layout.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/CompletionRegistrationPreview.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/PreviewUserList.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/UserCompletionRow.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/certificates/CertificateForm.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/certificates/CertificateView.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/certificates/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/completions/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/course-status-summary-for-user/[user_id]/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/emails/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/layout.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/permissions/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/points/page.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/points/user_id/ExerciseAccordion.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/points/user_id/ExerciseListSection.tsx`
- [x] `services/main-frontend/src/app/manage/course-instances/[id]/points/user_id/PeerOrSelfReviewSubmissionSummaryAccordion.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/change-requests/EditProposalPage.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/change-requests/EditProposalView.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/course-instances/NewCourseInstanceDialog.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/course-instances/NewCourseInstanceForm.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/feedback/FeedbackList.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/feedback/FeedbackPage.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/feedback/FeedbackView.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/chatbot/ChatbotConfigurationForm.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/chatbot/ChatbotPage.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/chatbot/CreateChatbotDialog.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/chatbot/CreateChatbotForm.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/cheaters/CheatersThresholdConfig.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/cheaters/CourseCheatersTabs.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/exercise-reset-tool/ExerciseList.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/exercise-reset-tool/ResetExercises.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/exercise-reset-tool/SelectedUsers.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/exercise-reset-tool/UserSearch.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/references/EditReferenceDialog.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/references/NewReferenceDialog.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/other/references/References.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/overview/EditCourseForm/index.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/overview/ManageCourse.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/ChapterFormDialog.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/ChapterImageDialog.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/ChapterImageWidget.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/CourseModules.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/ManageCourseStructure.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/NewChapterForm.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/NewOrEditPageForm.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/PageList/FrontPage.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/PageList/PageList.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/pages/PageList/PageListItem.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/CohortAnalysisChart.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/LineChart.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/LineChartByInstance.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/chartUtils.ts`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/all-languages/AllLanguageCompletionsChart.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/all-languages/AllLanguageStartingUsersChart.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/country/CompletionsByCountry.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/country/StudentsByCountry.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/course-instances/CourseCompletionsHistoryByInstance.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/course-instances/FirstExerciseSubmissionsHistoryByInstance.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/course-instances/UniqueUsersStartingHistoryByInstance.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/course-instances/UsersReturningExercisesHistoryByInstance.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/overview/CompletionsChart.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/overview/CourseUsersCountsByExercise.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/overview/StudentsStartingTheCourseChart.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/AverageTimeToSubmit.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/CohortProgress.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/CourseSubmissionsByDay.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/CourseSubmissionsByWeekdayAndHour.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/CourseUsersWithSubmissionsByDay.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/FirstExerciseSubmissionsByModule.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/FirstSubmissionTrends.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/user-activity/UsersReturningExercises.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/visitors/CourseVisitorsByCountry.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/visitors/DailyVisitCountsGroupedByReferrer.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/visitors/DailyVisitCountsGroupedByUtm.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/visitors/DeviceTypes.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/stats/visualizations/visitors/MostVisitedPages.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/students/tabs/CertificatesTab.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/students/tabs/CompletionsTab.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/students/tabs/ProgressTab.tsx`
- [x] `services/main-frontend/src/app/manage/courses/[id]/students/tabs/UserTab.tsx`
- [x] `services/main-frontend/src/app/manage/email-templates/page.tsx`
- [x] `services/main-frontend/src/app/manage/exams/EditExamDialog.tsx`
- [x] `services/main-frontend/src/app/manage/exams/NewExamDialog.tsx`
- [x] `services/main-frontend/src/app/manage/exams/[id]/layout.tsx`
- [x] `services/main-frontend/src/app/manage/exams/[id]/page.tsx`
- [x] `services/main-frontend/src/app/manage/exams/[id]/permissions/page.tsx`
- [x] `services/main-frontend/src/app/manage/exams/[id]/questions/page.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/answers-requiring-attention/page.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/exam-submissions/page.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/layout.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/AnswersRequiringAttentionItem.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/AnswersRequiringAttentionList.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/ExerciseAssignmentPreview.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/ExerciseSubmissionList.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/FlaggedPeerReviewAccordion.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/PeerOrSelfReviewAccordion.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/TeacherGradingDecisionControls.tsx`
- [x] `services/main-frontend/src/app/manage/exercises/[id]/submissions/page.tsx`
- [x] `services/main-frontend/src/app/manage/organizations/[id]/layout.tsx`
- [x] `services/main-frontend/src/app/manage/organizations/[id]/page.tsx`
- [x] `services/main-frontend/src/app/manage/organizations/[id]/permissions/page.tsx`
- [x] `services/main-frontend/src/app/manage/regradings/[id]/page.tsx`
- [x] `services/main-frontend/src/app/manage/regradings/page.tsx`
- [x] `services/main-frontend/src/app/manage/search-users/SearchUsersResults.tsx`
- [x] `services/main-frontend/src/app/manage/search-users/page.tsx`
- [x] `services/main-frontend/src/app/manage/users/[id]/CourseEnrollmentsList.tsx`
- [x] `services/main-frontend/src/app/manage/users/[id]/ExerciseResetLogList.tsx`
- [x] `services/main-frontend/src/app/manage/users/[id]/page.tsx`

## Course Material App

- [x] `services/main-frontend/src/app/org/[organizationSlug]/(course-material)/exams/ExamInfoHeader.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/(course-material)/exams/ExamPageShell.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/(course-material)/exams/ExamRunningSection.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/(course-material)/exams/ExamStartBanner.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/(course-material)/exams/[id]/ExamGradingView.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/(course-material)/exams/testexam/[id]/TestExamTeacherTools.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/ExamList.tsx`
- [x] `services/main-frontend/src/app/org/[organizationSlug]/OrganizationImageWidget.tsx`

## App

- [x] `services/main-frontend/src/app/MyCourses.tsx`
- [x] `services/main-frontend/src/app/completion-registration/[courseModuleId]/RegisterCompletion.tsx`
- [x] `services/main-frontend/src/app/completion-registration/[courseModuleId]/page.tsx`
- [x] `services/main-frontend/src/app/domain-stats/CourseCompletionStatsTable.tsx`
- [x] `services/main-frontend/src/app/domain-stats/DomainCompletionStatsTable.tsx`
- [x] `services/main-frontend/src/app/generate-certificate/page.tsx`
- [x] `services/main-frontend/src/app/join/page.tsx`
- [x] `services/main-frontend/src/app/oauth_authorize_scopes/page.tsx`
- [x] `services/main-frontend/src/app/playground-views/PlaygroundAnswers.tsx`
- [x] `services/main-frontend/src/app/playground-views/PlaygroundExerciseEditorIframe.tsx`
- [x] `services/main-frontend/src/app/playground-views/PlaygroundPreview.tsx`
- [x] `services/main-frontend/src/app/playground-views/PlaygroundSettings.tsx`
- [x] `services/main-frontend/src/app/playground-views/PlaygroundViewSubmissionIframe.tsx`
- [x] `services/main-frontend/src/app/playground-views/page.tsx`
- [x] `services/main-frontend/src/app/playground/page.tsx`
- [x] `services/main-frontend/src/app/signup/page.tsx`
- [x] `services/main-frontend/src/app/stats/GlobalStatTable.tsx`
- [x] `services/main-frontend/src/app/stats/page.tsx`
- [x] `services/main-frontend/src/app/status/StatusSummary.tsx`
- [x] `services/main-frontend/src/app/submissions/[id]/grading/SubmissionIFrame.tsx`
- [x] `services/main-frontend/src/app/submissions/[id]/grading/page.tsx`
- [x] `services/main-frontend/src/app/submissions/[id]/page.tsx`
- [x] `services/main-frontend/src/app/user-settings/permissions/page.tsx`

## Contexts

- [x] `services/main-frontend/src/contexts/course-material/GlossaryContext.ts`
- [x] `services/main-frontend/src/contexts/course-material/PageContext.tsx`

## Reducers

- [x] `services/main-frontend/src/reducers/__tests__/managePageOrderReducer.test.ts`
- [x] `services/main-frontend/src/reducers/course-material/exerciseBlockPostThisStateToIFrameReducer.ts`
- [x] `services/main-frontend/src/reducers/managePageOrderReducer.ts`

## Stores

- [x] `services/main-frontend/src/stores/course-material/materialFeedbackStore.ts`

## Other

- [x] `services/main-frontend/src/utils/course-material/__tests__/createChatbotTranscript.test.ts`
- [x] `services/main-frontend/src/utils/course-material/createChatbotTranscript.ts`
