import { useQuery } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ExerciseAttributes } from "../../../blocks/Exercise"
import PeerReviewEditor from "../../../components/PeerReviewEditor"
import PeerReviewAdditionalInstructionsEditor from "../../../components/editors/PeerReviewAdditionalInstructionsEditor"
import {
  getCoursesDefaultCmsPeerOrSelfReviewConfiguration,
  putCoursesDefaultCmsPeerOrSelfReviewConfiguration,
} from "../../../services/backend/courses"
import {
  CmsPeerOrSelfReviewConfig,
  CmsPeerOrSelfReviewConfiguration,
  CmsPeerOrSelfReviewQuestion,
} from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { isBlockInstanceArray } from "../../../utils/Gutenberg/blockInstance"
import { makeSurePeerOrSelfReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray } from "../../../utils/peerOrSelfReviewConfig"

interface PeerReviewManagerProps {
  // courseId
  query: SimplifiedUrlQuery<"id">
}

const PeerReviewManager: React.FC<React.PropsWithChildren<PeerReviewManagerProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState<Partial<Readonly<ExerciseAttributes>>>({
    peer_or_self_review_config: "{}",
    peer_or_self_review_questions_config: "[]",
    needs_peer_review: true,
    use_course_default_peer_review: false,
  })

  const { id } = query

  const peerOrSelfReviewConfigurationQuery = useQuery({
    queryKey: [`course-${id}-cms-peer-review-configuration`],
    queryFn: () => getCoursesDefaultCmsPeerOrSelfReviewConfiguration(id),
  })

  useEffect(() => {
    if (!peerOrSelfReviewConfigurationQuery.data) {
      return
    }
    setAttributes({
      peer_or_self_review_config: JSON.stringify(
        peerOrSelfReviewConfigurationQuery.data.peer_or_self_review_config,
      ),
      peer_or_self_review_questions_config: JSON.stringify(
        peerOrSelfReviewConfigurationQuery.data.peer_or_self_review_questions,
      ),
      needs_peer_review: true,
      use_course_default_peer_review: false,
    })
  }, [peerOrSelfReviewConfigurationQuery.data])

  const mutateCourseDefaultPeerReview = useToastMutation(
    () => {
      {
        let prc: CmsPeerOrSelfReviewConfig = JSON.parse(attributes.peer_or_self_review_config ?? "{}")
        prc = makeSurePeerOrSelfReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray(prc)
        const prq: CmsPeerOrSelfReviewQuestion[] = JSON.parse(
          attributes.peer_or_self_review_questions_config ?? "[]",
        )
        const configuration: CmsPeerOrSelfReviewConfiguration = {
          peer_or_self_review_config: prc,
          peer_or_self_review_questions: prq,
        }
        return putCoursesDefaultCmsPeerOrSelfReviewConfiguration(id, configuration)
      }
    },
    {
      notify: true,
      method: "PUT",
      errorMessage: t("default-toast-error-message"),
      successMessage: t("default-toast-success-message"),
    },

    { onSuccess: () => peerOrSelfReviewConfigurationQuery.refetch() },
  )

  const parsedAdditionalInstructions: BlockInstance[] = useMemo(() => {
    const parsedConfig = JSON.parse(
      attributes.peer_or_self_review_config ?? "{}",
    ) as CmsPeerOrSelfReviewConfig
    const additionalInstructions = parsedConfig?.review_instructions
    if (isBlockInstanceArray(additionalInstructions)) {
      return additionalInstructions
    }
    return []
  }, [attributes.peer_or_self_review_config])

  const updateAdditionalInstructions = useCallback((newValue: BlockInstance[]) => {
    setAttributes((prev) => {
      const newConfig = JSON.parse(prev.peer_or_self_review_config ?? "{}") as CmsPeerOrSelfReviewConfig
      newConfig.review_instructions = newValue
      return {
        ...prev,
        peer_or_self_review_config: JSON.stringify(newConfig),
      }
    })
  }, [])

  if (peerOrSelfReviewConfigurationQuery.isError) {
    return <ErrorBanner error={peerOrSelfReviewConfigurationQuery.error} variant="text" />
  }

  if (peerOrSelfReviewConfigurationQuery.isPending) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <PeerReviewEditor
        attributes={attributes}
        setAttributes={setAttributes}
        courseId={peerOrSelfReviewConfigurationQuery.data.peer_or_self_review_config.course_id}
        courseGlobalEditor={true}
        instructionsEditor={
          <PeerReviewAdditionalInstructionsEditor
            content={parsedAdditionalInstructions}
            setContent={updateAdditionalInstructions}
            courseId={peerOrSelfReviewConfigurationQuery.data.peer_or_self_review_config.course_id}
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
