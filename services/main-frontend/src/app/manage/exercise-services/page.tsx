"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseServiceContainer from "./ExerciseServiceContainer"
import ExerciseServiceCreationModal from "./ExerciseServiceCreationModal"

import {
  createExerciseServiceMutationOptions,
  getExerciseServicesOptions,
} from "@/services/backend/exercise-services"
import { ExerciseServiceNewOrUpdate } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { canSave } from "@/utils/canSaveExerciseService"
import { convertToSlug } from "@/utils/convert"
import { prepareExerciseServiceForBackend } from "@/utils/prepareServiceForBackend.ts"

const ExerciseServicePage: React.FC = () => {
  const { t } = useTranslation()
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
      } catch (_e) {
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

  return (
    <div>
      <h1>{t("title-manage-exercise-services")}</h1>
      <Button onClick={openModal} variant="primary" size="medium">
        {t("button-text-new")}
      </Button>
      <br />
      {getExerciseServices.isError && (
        <ErrorBanner variant={"readOnly"} error={getExerciseServices.error} />
      )}
      {getExerciseServices.isLoading && <Spinner variant={"medium"} />}
      {getExerciseServices.isSuccess && (
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
      )}
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(ExerciseServicePage)))
