import { css } from "@emotion/css"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseList from "./ExerciseList"
import ResetFilter from "./ResetFilter"
import SelectedUsers from "./SelectedUsers"

import { useUsers } from "@/hooks/useUsers"
import { CourseManagementPagesProps } from "@/pages/manage/courses/[id]/[...path]"
import { resetExercisesForUsers } from "@/services/backend/exercises"
import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, secondaryFont } from "@/shared-module/common/styles"

const ResetExercises: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { data: users, isLoading } = useUsers(courseId)
  const [selectedUsers, setSelectedUsers] = useState<UserDetail[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [resetOnlyLockedPeerReviews, setResetOnlyLockedPeerReviews] = useState<boolean>(false)
  const [resetAllBelowMaxPoints, setResetAllBelowMaxPoints] = useState<boolean>(false)

  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    () => {
      return resetExercisesForUsers(
        courseId,
        selectedUsers.map((u) => u.user_id),
        selectedExerciseIds,
        threshold,
        resetAllBelowMaxPoints,
        resetOnlyLockedPeerReviews,
      )
    },
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
          users={users}
          isLoading={isLoading}
          addUser={addUser}
        />
      </div>

      <ResetFilter
        threshold={threshold}
        setThreshold={setThreshold}
        resetAllBelowMaxPoints={resetAllBelowMaxPoints}
        setResetAllBelowMaxPoints={setResetAllBelowMaxPoints}
        resetOnlyLockedPeerReviews={resetOnlyLockedPeerReviews}
        setResetOnlyLockedPeerReviews={setResetOnlyLockedPeerReviews}
      ></ResetFilter>
      <ExerciseList
        courseId={courseId}
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
        <StandardDialog
          onClose={() => setIsModalOpen(false)}
          title={t("confirm-reset-title")}
          open={isModalOpen}
          buttons={[
            {
              // eslint-disable-next-line i18next/no-literal-string
              variant: "primary",
              onClick: () => resetMutation.mutate(),
              disabled: selectedUsers.length === 0 || selectedExerciseIds.length === 0,
              children: t("button-reset"),
            },
            {
              // eslint-disable-next-line i18next/no-literal-string
              variant: "secondary",
              onClick: () => setIsModalOpen(false),
              children: t("button-text-cancel"),
            },
          ]}
        >
          <div>
            <p>{t("confirm-reset-message")}</p>
            {(resetAllBelowMaxPoints || threshold || resetOnlyLockedPeerReviews) && (
              <div>
                <p
                  className={css`
                    font-weight: ${fontWeights.medium};
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
        </StandardDialog>
      )}
    </div>
  )
}

export default ResetExercises
