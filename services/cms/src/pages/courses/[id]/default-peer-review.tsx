import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ExerciseAttributes } from "../../../blocks/Exercise"
import PeerReviewEditor from "../../../components/PeerReviewEditor"
import PeerReviewAdditionalInstructionsEditor from "../../../components/editors/PeerReviewAdditionalInstructionsEditor"
import {
  getCoursesDefaultCmsPeerReviewConfiguration,
  putCoursesDefaultCmsPeerReviewConfiguration,
} from "../../../services/backend/courses"
import { MediaUploadProps } from "../../../services/backend/media/mediaUpload"
import {
  CmsPeerReviewConfig,
  CmsPeerReviewConfiguration,
  CmsPeerReviewQuestion,
} from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface PeerReviewManagerProps {
  // courseId
  query: SimplifiedUrlQuery<"id">
}

const PeerReviewManager: React.FC<React.PropsWithChildren<PeerReviewManagerProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState<Partial<Readonly<ExerciseAttributes>>>({
    peer_review_config: "{}",
    peer_review_questions_config: "[]",
    needs_peer_review: true,
    use_course_default_peer_review: false,
  })

  const { id } = query

  const getCmsPeerReviewConfiguration = useQuery({
    queryKey: [`course-${id}-cms-peer-review-configuration`],
    queryFn: () => getCoursesDefaultCmsPeerReviewConfiguration(id),
  })

  useEffect(() => {
    if (!getCmsPeerReviewConfiguration.data) {
      return
    }
    setAttributes({
      peer_review_config: JSON.stringify(getCmsPeerReviewConfiguration.data.peer_review_config),
      peer_review_questions_config: JSON.stringify(
        getCmsPeerReviewConfiguration.data.peer_review_questions,
      ),
      needs_peer_review: true,
      use_course_default_peer_review: false,
    })
  }, [getCmsPeerReviewConfiguration.data])

  const mutateCourseDefaultPeerReview = useToastMutation(
    () => {
      {
        const prc: CmsPeerReviewConfig = JSON.parse(attributes.peer_review_config ?? "{}")
        const prq: CmsPeerReviewQuestion[] = JSON.parse(
          attributes.peer_review_questions_config ?? "[]",
        )
        const configuration: CmsPeerReviewConfiguration = {
          peer_review_config: prc,
          peer_review_questions: prq,
        }
        return putCoursesDefaultCmsPeerReviewConfiguration(id, configuration)
      }
    },
    {
      notify: true,
      method: "PUT",
      errorMessage: t("default-toast-error-message"),
      successMessage: t("default-toast-success-message"),
    },

    { onSuccess: () => getCmsPeerReviewConfiguration.refetch() },
  )

  // Detect focus change
  useEffect(() => {
    const handleFocusChange = (e: FocusEvent) => {
      if (additionalInstructionsWrapperRef.current?.contains(e.target as Node)) {
        setAdditionalInstructionsFocused(true)
      } else {
        setAdditionalInstructionsFocused(false)
      }
    }

    document.addEventListener("focusin", handleFocusChange)
    document.addEventListener("focusout", handleFocusChange)
    return () => {
      document.removeEventListener("focusin", handleFocusChange)
      document.removeEventListener("focusout", handleFocusChange)
    }
  }, [])

  if (getCmsPeerReviewConfiguration.isError) {
    return <ErrorBanner error={getCmsPeerReviewConfiguration.error} variant="text" />
  }

  if (getCmsPeerReviewConfiguration.isPending) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <PeerReviewEditor
        attributes={attributes}
        setAttributes={setAttributes}
        courseId={getCmsPeerReviewConfiguration.data.peer_review_config.course_id}
        courseGlobalEditor={true}
        instructionsEditor={
          <PeerReviewAdditionalInstructionsEditor
            content={[]}
            setContent={function (value: BlockInstance<{ [k: string]: any }>[]): void {
              throw new Error("Function not implemented.")
            }}
          />
        }
      />
      <Button
        variant="primary"
        size="medium"
        onClick={() => mutateCourseDefaultPeerReview.mutate()}
      >
        {t("save")}
      </Button>
    </>
  )
}

const exported = dontRenderUntilQueryParametersReady(PeerReviewManager)

// @ts-expect-error: hideBreadcrumbs is an addtional property on exported
exported.hideBreadcrumbs = true

export default exported
