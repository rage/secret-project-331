/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "exercise-service-protocol-types.ts".
 * WARNING: Do not manually change this file.
 */
import { MessageFromIframe, CurrentStateMessage, HeightChangedMessage, OpenLinkMessage, FileUploadMessage, RequestRepositoryExercisesMessage, TestRequestMessage, MessageToIframe, SetLanguageMessage, SetStateMessage, UploadResultMessage, RepositoryExercisesMessage, TestResultsMessage, UserInformation, UserVariablesMap, AnswerExerciseIframeState, ViewSubmissionIframeState, ExerciseEditorIframeState, CustomViewIframeState, ExerciseIframeState, ExtendedIframeState, IframeViewType, NonGenericGradingRequest, NonGenericGradingResult } from "./exercise-service-protocol-types";

export function isMessageFromIframe(obj: unknown): obj is MessageFromIframe {
    const typedObj = obj as MessageFromIframe
    return (
        (isCurrentStateMessage(typedObj) as boolean ||
            isHeightChangedMessage(typedObj) as boolean ||
            isFileUploadMessage(typedObj) as boolean ||
            isRequestRepositoryExercisesMessage(typedObj) as boolean ||
            isTestRequestMessage(typedObj) as boolean)
    )
}

export function isCurrentStateMessage(obj: unknown): obj is CurrentStateMessage {
    const typedObj = obj as CurrentStateMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "current-state" &&
        typeof typedObj["valid"] === "boolean"
    )
}

export function isHeightChangedMessage(obj: unknown): obj is HeightChangedMessage {
    const typedObj = obj as HeightChangedMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "height-changed" &&
        typeof typedObj["data"] === "number"
    )
}

export function isOpenLinkMessage(obj: unknown): obj is OpenLinkMessage {
    const typedObj = obj as OpenLinkMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "open-link" &&
        typeof typedObj["data"] === "string"
    )
}

export function isFileUploadMessage(obj: unknown): obj is FileUploadMessage {
    const typedObj = obj as FileUploadMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "file-upload" &&
        typedObj["files"] instanceof Map
    )
}

export function isRequestRepositoryExercisesMessage(obj: unknown): obj is RequestRepositoryExercisesMessage {
    const typedObj = obj as RequestRepositoryExercisesMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "request-repository-exercises"
    )
}

export function isTestRequestMessage(obj: unknown): obj is TestRequestMessage {
    const typedObj = obj as TestRequestMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "test-request" &&
        typeof typedObj["archiveDownloadUrl"] === "string" &&
        Array.isArray(typedObj["files"]) &&
        typedObj["files"].every((e: any) =>
            (e !== null &&
                typeof e === "object" ||
                typeof e === "function") &&
            typeof e["filepath"] === "string" &&
            typeof e["contents"] === "string"
        )
    )
}

export function isMessageToIframe(obj: unknown): obj is MessageToIframe {
    const typedObj = obj as MessageToIframe
    return (
        (isSetLanguageMessage(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isAnswerExerciseIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isViewSubmissionIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isExerciseEditorIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isCustomViewIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "upload-result" &&
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["success"] === true &&
            typedObj["urls"] instanceof Map ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "upload-result" &&
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["success"] === false &&
            typeof typedObj["error"] === "string" ||
            isRepositoryExercisesMessage(typedObj) as boolean ||
            isTestResultsMessage(typedObj) as boolean)
    )
}

export function isSetLanguageMessage(obj: unknown): obj is SetLanguageMessage {
    const typedObj = obj as SetLanguageMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "set-language" &&
        typeof typedObj["data"] === "string"
    )
}

export function isSetStateMessage(obj: unknown): obj is SetStateMessage {
    const typedObj = obj as SetStateMessage
    return (
        ((typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isAnswerExerciseIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isViewSubmissionIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isExerciseEditorIframeState(typedObj) as boolean ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "set-state" &&
            isCustomViewIframeState(typedObj) as boolean)
    )
}

export function isUploadResultMessage(obj: unknown): obj is UploadResultMessage {
    const typedObj = obj as UploadResultMessage
    return (
        ((typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
            typedObj["message"] === "upload-result" &&
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["success"] === true &&
            typedObj["urls"] instanceof Map ||
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["message"] === "upload-result" &&
            (typedObj !== null &&
                typeof typedObj === "object" ||
                typeof typedObj === "function") &&
            typedObj["success"] === false &&
            typeof typedObj["error"] === "string")
    )
}

export function isRepositoryExercisesMessage(obj: unknown): obj is RepositoryExercisesMessage {
    const typedObj = obj as RepositoryExercisesMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "repository-exercises" &&
        Array.isArray(typedObj["repository_exercises"]) &&
        typedObj["repository_exercises"].every((e: any) =>
            (e !== null &&
                typeof e === "object" ||
                typeof e === "function") &&
            typeof e["id"] === "string" &&
            typeof e["repository_id"] === "string" &&
            typeof e["part"] === "string" &&
            typeof e["name"] === "string" &&
            typeof e["repository_url"] === "string" &&
            Array.isArray(e["checksum"]) &&
            e["checksum"].every((e: any) =>
                typeof e === "number"
            ) &&
            typeof e["download_url"] === "string"
        )
    )
}

export function isTestResultsMessage(obj: unknown): obj is TestResultsMessage {
    const typedObj = obj as TestResultsMessage
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["message"] === "test-results"
    )
}

export function isUserInformation(obj: unknown): obj is UserInformation {
    const typedObj = obj as UserInformation
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typeof typedObj["pseudonymous_id"] === "string" &&
        typeof typedObj["signed_in"] === "boolean"
    )
}

export function isUserVariablesMap(obj: unknown): obj is UserVariablesMap {
    const typedObj = obj as UserVariablesMap
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        Object.entries<any>(typedObj)
            .every(([key, _value]) => (typeof key === "string"))
    )
}

export function isAnswerExerciseIframeState(obj: unknown): obj is AnswerExerciseIframeState {
    const typedObj = obj as AnswerExerciseIframeState
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["view_type"] === "answer-exercise" &&
        typeof typedObj["exercise_task_id"] === "string" &&
        isUserInformation(typedObj["user_information"]) as boolean &&
        (typeof typedObj["user_variables"] === "undefined" ||
            typedObj["user_variables"] === null ||
            isUserVariablesMap(typedObj["user_variables"]) as boolean) &&
        (typedObj["data"] !== null &&
            typeof typedObj["data"] === "object" ||
            typeof typedObj["data"] === "function")
    )
}

export function isViewSubmissionIframeState(obj: unknown): obj is ViewSubmissionIframeState {
    const typedObj = obj as ViewSubmissionIframeState
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["view_type"] === "view-submission" &&
        typeof typedObj["exercise_task_id"] === "string" &&
        isUserInformation(typedObj["user_information"]) as boolean &&
        (typeof typedObj["user_variables"] === "undefined" ||
            typedObj["user_variables"] === null ||
            isUserVariablesMap(typedObj["user_variables"]) as boolean) &&
        (typedObj["data"] !== null &&
            typeof typedObj["data"] === "object" ||
            typeof typedObj["data"] === "function") &&
        (typedObj["data"]["grading"] === null ||
            (typedObj["data"]["grading"] !== null &&
                typeof typedObj["data"]["grading"] === "object" ||
                typeof typedObj["data"]["grading"] === "function") &&
            (typedObj["data"]["grading"]["grading_progress"] === "Failed" ||
                typedObj["data"]["grading"]["grading_progress"] === "NotReady" ||
                typedObj["data"]["grading"]["grading_progress"] === "PendingManual" ||
                typedObj["data"]["grading"]["grading_progress"] === "Pending" ||
                typedObj["data"]["grading"]["grading_progress"] === "FullyGraded") &&
            typeof typedObj["data"]["grading"]["score_given"] === "number" &&
            typeof typedObj["data"]["grading"]["score_maximum"] === "number" &&
            (typedObj["data"]["grading"]["feedback_text"] === null ||
                typeof typedObj["data"]["grading"]["feedback_text"] === "string") &&
            (typeof typedObj["data"]["grading"]["set_user_variables"] === "undefined" ||
                (typedObj["data"]["grading"]["set_user_variables"] !== null &&
                    typeof typedObj["data"]["grading"]["set_user_variables"] === "object" ||
                    typeof typedObj["data"]["grading"]["set_user_variables"] === "function") &&
                Object.entries<any>(typedObj["data"]["grading"]["set_user_variables"])
                    .every(([key, _value]) => (typeof key === "string"))))
    )
}

export function isExerciseEditorIframeState(obj: unknown): obj is ExerciseEditorIframeState {
    const typedObj = obj as ExerciseEditorIframeState
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["view_type"] === "exercise-editor" &&
        typeof typedObj["exercise_task_id"] === "string" &&
        isUserInformation(typedObj["user_information"]) as boolean &&
        (typeof typedObj["repository_exercises"] === "undefined" ||
            Array.isArray(typedObj["repository_exercises"]) &&
            typedObj["repository_exercises"].every((e: any) =>
                (e !== null &&
                    typeof e === "object" ||
                    typeof e === "function") &&
                typeof e["id"] === "string" &&
                typeof e["repository_id"] === "string" &&
                typeof e["part"] === "string" &&
                typeof e["name"] === "string" &&
                typeof e["repository_url"] === "string" &&
                Array.isArray(e["checksum"]) &&
                e["checksum"].every((e: any) =>
                    typeof e === "number"
                ) &&
                typeof e["download_url"] === "string"
            )) &&
        (typedObj["data"] !== null &&
            typeof typedObj["data"] === "object" ||
            typeof typedObj["data"] === "function")
    )
}

export function isCustomViewIframeState(obj: unknown): obj is CustomViewIframeState {
    const typedObj = obj as CustomViewIframeState
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typedObj["view_type"] === "custom-view" &&
        (typedObj["user_information"] !== null &&
            typeof typedObj["user_information"] === "object" ||
            typeof typedObj["user_information"] === "function") &&
        typeof typedObj["user_information"]["user_id"] === "string" &&
        (typedObj["user_information"]["first_name"] === null ||
            typeof typedObj["user_information"]["first_name"] === "string") &&
        (typedObj["user_information"]["last_name"] === null ||
            typeof typedObj["user_information"]["last_name"] === "string") &&
        (typeof typedObj["user_variables"] === "undefined" ||
            typedObj["user_variables"] === null ||
            isUserVariablesMap(typedObj["user_variables"]) as boolean) &&
        typeof typedObj["course_name"] === "string" &&
        (typedObj["module_completion_date"] === null ||
            typeof typedObj["module_completion_date"] === "string") &&
        (typedObj["data"] !== null &&
            typeof typedObj["data"] === "object" ||
            typeof typedObj["data"] === "function") &&
        Array.isArray(typedObj["data"]["submissions_by_exercise"]) &&
        typedObj["data"]["submissions_by_exercise"].every((e: any) =>
            (e !== null &&
                typeof e === "object" ||
                typeof e === "function") &&
            typeof e["exercise_id"] === "string" &&
            typeof e["exercise_name"] === "string" &&
            Array.isArray(e["exercise_tasks"]) &&
            e["exercise_tasks"].every((e: any) =>
                (e !== null &&
                    typeof e === "object" ||
                    typeof e === "function") &&
                typeof e["task_id"] === "string"
            )
        )
    )
}

export function isExerciseIframeState(obj: unknown): obj is ExerciseIframeState {
    const typedObj = obj as ExerciseIframeState
    return (
        (isAnswerExerciseIframeState(typedObj) as boolean ||
            isViewSubmissionIframeState(typedObj) as boolean ||
            isExerciseEditorIframeState(typedObj) as boolean)
    )
}

export function isExtendedIframeState(obj: unknown): obj is ExtendedIframeState {
    const typedObj = obj as ExtendedIframeState
    return (
        (isAnswerExerciseIframeState(typedObj) as boolean ||
            isViewSubmissionIframeState(typedObj) as boolean ||
            isExerciseEditorIframeState(typedObj) as boolean ||
            isCustomViewIframeState(typedObj) as boolean)
    )
}

export function isIframeViewType(obj: unknown): obj is IframeViewType {
    const typedObj = obj as IframeViewType
    return (
        (typedObj === "answer-exercise" ||
            typedObj === "view-submission" ||
            typedObj === "exercise-editor")
    )
}

export function isNonGenericGradingRequest(obj: unknown): obj is NonGenericGradingRequest {
    const typedObj = obj as NonGenericGradingRequest
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typeof typedObj["grading_update_url"] === "string"
    )
}

export function isNonGenericGradingResult(obj: unknown): obj is NonGenericGradingResult {
    const typedObj = obj as NonGenericGradingResult
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        (typedObj["grading_progress"] === "Failed" ||
            typedObj["grading_progress"] === "PendingManual" ||
            typedObj["grading_progress"] === "Pending" ||
            typedObj["grading_progress"] === "FullyGraded") &&
        typeof typedObj["score_given"] === "number" &&
        typeof typedObj["score_maximum"] === "number" &&
        (typedObj["feedback_text"] === null ||
            typeof typedObj["feedback_text"] === "string") &&
        (typeof typedObj["set_user_variables"] === "undefined" ||
            (typedObj["set_user_variables"] !== null &&
                typeof typedObj["set_user_variables"] === "object" ||
                typeof typedObj["set_user_variables"] === "function") &&
            Object.entries<any>(typedObj["set_user_variables"])
                .every(([key, _value]) => (typeof key === "string")))
    )
}
