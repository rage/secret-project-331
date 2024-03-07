import { useQuery } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ExerciseAttributes } from "../../../blocks/Exercise"
import PeerReviewEditor from "../../../components/PeerReviewEditor"
import PeerReviewAdditionalInstructionsEditor from "../../../components/editors/PeerReviewAdditionalInstructionsEditor"
import {
  getCoursesDefaultCmsPeerReviewConfiguration,
  putCoursesDefaultCmsPeerReviewConfiguration,
} from "../../../services/backend/courses"
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
import { isBlockInstanceArray } from "../../../utils/Gutenberg/blockInstance"
import { makeSurePeerReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray } from "../../../utils/peerReviewConfig"

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

  const peerReviewConfigurationQuery = useQuery({
    queryKey: [`course-${id}-cms-peer-review-configuration`],
    queryFn: () => getCoursesDefaultCmsPeerReviewConfiguration(id),
  })

  useEffect(() => {
    if (!peerReviewConfigurationQuery.data) {
      return
    }
    setAttributes({
      peer_review_config: JSON.stringify(peerReviewConfigurationQuery.data.peer_review_config),
      peer_review_questions_config: JSON.stringify(
        peerReviewConfigurationQuery.data.peer_review_questions,
      ),
      needs_peer_review: true,
      use_course_default_peer_review: false,
    })
  }, [peerReviewConfigurationQuery.data])

  const mutateCourseDefaultPeerReview = useToastMutation(
    () => {
      {
        let prc: CmsPeerReviewConfig = JSON.parse(attributes.peer_review_config ?? "{}")
        prc = makeSurePeerReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray(prc)
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

    { onSuccess: () => peerReviewConfigurationQuery.refetch() },
  )

  const parsedAdditionalInstructions: BlockInstance[] = useMemo(() => {
    const parsedConfig = JSON.parse(attributes.peer_review_config ?? "{}") as CmsPeerReviewConfig
    const additionalInstructions = parsedConfig?.review_instructions
    if (isBlockInstanceArray(additionalInstructions)) {
      return additionalInstructions
    }
    return []
  }, [attributes.peer_review_config])

  const updateAdditionalInstructions = useCallback((newValue: BlockInstance[]) => {
    setAttributes((prev) => {
      const newConfig = JSON.parse(prev.peer_review_config ?? "{}") as CmsPeerReviewConfig
      newConfig.review_instructions = newValue
      return {
        ...prev,
        peer_review_config: JSON.stringify(newConfig),
      }
    })
  }, [])

  if (peerReviewConfigurationQuery.isError) {
    return <ErrorBanner error={peerReviewConfigurationQuery.error} variant="text" />
  }

  if (peerReviewConfigurationQuery.isPending) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <PeerReviewEditor
        attributes={attributes}
        setAttributes={setAttributes}
        courseId={peerReviewConfigurationQuery.data.peer_review_config.course_id}
        courseGlobalEditor={true}
        instructionsEditor={
          <PeerReviewAdditionalInstructionsEditor
            content={parsedAdditionalInstructions}
            setContent={updateAdditionalInstructions}
            courseId={peerReviewConfigurationQuery.data.peer_review_config.course_id}
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
