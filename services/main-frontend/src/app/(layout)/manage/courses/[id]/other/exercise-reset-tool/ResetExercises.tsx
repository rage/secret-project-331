"use client"

import { css } from "@emotion/css"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CourseManagementPagesProps } from "@/app/(layout)/manage/courses/[id]/types"
import { resetExercisesForSelectedUsers } from "@/generated/api/sdk.generated"
import type { UserDetail } from "@/generated/api/types.generated"
import { useUsers } from "@/hooks/useUsers"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, secondaryFont } from "@/shared-module/common/styles"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Button, Dialog } from "@/shared-module/components"

import ExerciseList from "./ExerciseList"
import ResetFilter from "./ResetFilter"
import SelectedUsers from "./SelectedUsers"

export interface ResetFormFields {
  onlyResetBelowThreshold: boolean
  resetAllBelowMaxPoints: boolean
  resetOnlyLockedPeerReviews: boolean
  selectedExercises: Record<string, boolean>
}

const ResetExercises: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { data: users, isLoading } = useUsers(courseId)
  const [selectedUsers, setSelectedUsers] = useState<UserDetail[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [threshold, setThreshold] = useState<number | null>(null)

  const { control, watch, setValue } = useForm<ResetFormFields>({
    defaultValues: {
      onlyResetBelowThreshold: false,
      resetAllBelowMaxPoints: false,
      resetOnlyLockedPeerReviews: false,
      selectedExercises: {},
    },
  })
  const resetOnlyLockedPeerReviews = watch("resetOnlyLockedPeerReviews")
  const resetAllBelowMaxPoints = watch("resetAllBelowMaxPoints")
  const selectedExercisesMap = watch("selectedExercises")
  const selectedExerciseIds = useMemo(
    () =>
      Object.entries(selectedExercisesMap)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [selectedExercisesMap],
  )
  const setSelectedExerciseIds = (ids: string[]) => {
    setValue("selectedExercises", Object.fromEntries(ids.map((id) => [id, true])))
  }

  useEffect(() => {
    if (!users) {
      return
    }
    const urlParams = new URLSearchParams(window.location.search)
    const userIdFromUrl = urlParams.get("user_id")

    if (userIdFromUrl) {
      const user = users.find((u) => u.user_id === userIdFromUrl)
      if (user) {
        addUser(user)
      }
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [users])

  const addUser = (user: UserDetail) => {
    if (!selectedUsers.some((u) => u.user_id === user.user_id)) {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((user) => user.user_id !== userId))
  }

  const resetMutation = useToastMutation(
    () =>
      resetExercisesForSelectedUsers({
        body: {
          user_ids: selectedUsers.map((u) => u.user_id),
          exercise_ids: selectedExerciseIds,
          threshold,
          reset_all_below_max_points: resetAllBelowMaxPoints,
          reset_only_locked_peer_reviews: resetOnlyLockedPeerReviews,
        },
        path: {
          course_id: courseId,
        },
      }),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        setSelectedUsers([])
        setSelectedExerciseIds([])
        setIsModalOpen(false)
      },
    },
  )

  return (
    <div>
      <h3
        className={css`
          color: ${baseTheme.colors.gray[700]};
          font-family: ${secondaryFont};
          padding-bottom: 22px;
          font-weight: ${fontWeights.medium};
        `}
      >
        {t("title-reset-exercises")}
      </h3>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          justify-content: center;
        `}
      >
        <SelectedUsers
          selectedUsers={selectedUsers}
          removeUser={removeUser}
          isLoading={isLoading}
          addUser={addUser}
          {...omitUndefined({ users })}
        />
      </div>

      <ResetFilter control={control} threshold={threshold} setThreshold={setThreshold} />

      <div
        className={css`
          border: 1px solid #e4e4e4;
          margin-bottom: 30px;
        `}
      ></div>

      <ExerciseList
        courseId={courseId}
        control={control}
        selectedExerciseIds={selectedExerciseIds}
        setSelectedExerciseIds={setSelectedExerciseIds}
      />

      <div>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size={"medium"}
          className={css`
            margin-top: 1rem;
          `}
        >
          {t("button-text-submit-and-reset")}
        </Button>
      </div>

      {isModalOpen && (
        <Dialog
          onClose={() => setIsModalOpen(false)}
          title={t("confirm-reset-title")}
          open={isModalOpen}
          actions={[
            {
              variant: "primary",
              onClick: () => resetMutation.mutate(),
              disabled: selectedUsers.length === 0 || selectedExerciseIds.length === 0,
              label: t("button-reset"),
            },
            {
              variant: "secondary",
              onClick: () => setIsModalOpen(false),
              label: t("button-text-cancel"),
            },
          ]}
        >
          <div
            className={css`
              padding-left: -10px;
            `}
          >
            <p
              className={css`
                font-weight: ${fontWeights.medium};
                font-size: ${baseTheme.fontSizes[2]}px;
                padding-left: -10px;
              `}
            >
              {t("confirm-reset-message")}
            </p>
            {(resetAllBelowMaxPoints || threshold || resetOnlyLockedPeerReviews) && (
              <div>
                <p
                  className={css`
                    margin-top: 1rem;
                    opacity: 0.8;
                    color: #1a2333;
                  `}
                >
                  {t("filters")}:
                </p>
                {resetAllBelowMaxPoints && <p>{t("label-reset-only-if-less-than-max-points")}</p>}
                {threshold && (
                  <p>{t("label-reset-only-if-less-than-threshold", { threshold: threshold })}</p>
                )}
                {resetOnlyLockedPeerReviews && <p>{t("label-reset-only-if-reviewedAndLocked")}</p>}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  )
}

export default ResetExercises
