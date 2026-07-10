"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseServiceContainer from "./ExerciseServiceContainer"
import ExerciseServiceCreationModal from "./ExerciseServiceCreationModal"

import {
  createExerciseServiceMutation as createExerciseServiceMutationOptions,
  getExerciseServicesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseServiceNewOrUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"
import { canSave } from "@/utils/canSaveExerciseService"
import { convertToSlug } from "@/utils/convert"
import { prepareExerciseServiceForBackend } from "@/utils/prepareServiceForBackend.ts"

const ExerciseServicePage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-manage-exercise-services"))
  const [open, setOpen] = useState(false)
  const [exerciseService, setExerciseService] = useState<ExerciseServiceNewOrUpdate>({
    name: "",
    slug: "",
    public_url: "",
    internal_url: "",
    max_reprocessing_submissions_at_once: 1,
  })

  const getExerciseServices = useQuery(getExerciseServicesOptions())

  const sortedExerciseServices = useMemo(
    () => [...(getExerciseServices.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [getExerciseServices.data],
  )

  const createExerciseServiceMutation = useToastMutationOptions(
    createExerciseServiceMutationOptions(),
    { notify: true, method: "POST" },
    {
      onSuccess: async (result) => {
        if (result.service_info_error) {
          showErrorNotification({
            header: t("could-not-connect-to-exercise-service-header"),
            message: t("could-not-connect-to-exercise-service-message", {
              message: result.service_info_error,
            }),
          })
        }

        await getExerciseServices.refetch()
        handleClose()
        resetExerciseService()
      },
    },
  )

  const resetExerciseService = () => {
    setExerciseService({
      name: "",
      slug: "",
      public_url: "",
      internal_url: "",
      max_reprocessing_submissions_at_once: 1,
    })
  }

  const onChangeName = (value: string) => {
    setExerciseService({
      ...exerciseService,
      name: value,
      slug: convertToSlug(value),
    })
  }

  const onChangeCreationModal = (key: string) => (value: string) => {
    if (key === "max_reprocessing_submissions_at_once") {
      try {
        setExerciseService({
          ...exerciseService,
          [key]: Number(value),
        })
      } catch {
        // NOP
      }
    } else {
      setExerciseService({
        ...exerciseService,
        [key]: value,
      })
    }
  }

  const handleClose = () => {
    setOpen(false)
  }

  const openModal = () => {
    setOpen(true)
  }

  const renderExerciseServices = () => (
    <>
      <ExerciseServiceContainer
        exerciseServices={sortedExerciseServices}
        refetch={getExerciseServices.refetch}
      />
      <ExerciseServiceCreationModal
        open={open}
        handleClose={handleClose}
        exercise_service={exerciseService}
        onChange={onChangeCreationModal}
        onChangeName={onChangeName}
        handleSubmit={async () => {
          if (!canSave(exerciseService)) {
            return
          }

          await createExerciseServiceMutation.mutateAsync({
            body: prepareExerciseServiceForBackend(exerciseService),
          })
        }}
      />
    </>
  )

  return (
    <div>
      <h1>{t("title-manage-exercise-services")}</h1>
      <Button onClick={openModal} variant="primary" size="medium">
        {t("button-text-new")}
      </Button>
      <br />
      <QueryResult query={getExerciseServices} treatEmptyAsData>
        {() => renderExerciseServices()}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(ExerciseServicePage)))
