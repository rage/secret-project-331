import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import useCourseQuery from "@/hooks/useCourseQuery"
import { useUserDetails } from "@/hooks/useUserDetails"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const GRID_AREAS = {
  COURSE: "course",
  INSTANCE: "instance",
  FIRST: "first",
  LAST: "last",
  EMAIL: "email",
} as const

const CourseInfoBoxContainer = styled.div`
  background-color: white;
  border: 1px solid ${baseTheme.colors.clear[200]};
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px ${baseTheme.colors.clear[100]};

  ${respondToOrLarger.md} {
    padding: 1.5rem;
  }
`

const InfoGrid = styled.div`
  display: grid;
  gap: 1rem;

  ${respondToOrLarger.md} {
    grid-template-columns: repeat(8, 1fr);
    grid-template-areas:
      "course course course course instance instance instance instance"
      "first first last last email email email email";
    gap: 1.25rem;
  }
`

interface InfoSectionProps {
  gridArea: string
}

const InfoSection = styled.div<InfoSectionProps>`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 6px;
  background-color: ${baseTheme.colors.clear[100]};

  ${respondToOrLarger.md} {
    grid-area: ${({ gridArea }) => gridArea};
  }
`

const InfoLabel = styled.span`
  font-size: 0.75rem;
  color: ${baseTheme.colors.gray[400]};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
`

const InfoValue = styled.span`
  font-size: 1rem;
  font-weight: 500;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.3;
`

interface CourseInstanceUserInfoBoxProps {
  courseId: string
  courseInstanceId: string
  userId: string
}

interface CourseInstance {
  id: string
  name?: string
}

const CourseInstanceUserInfoBox: React.FC<CourseInstanceUserInfoBoxProps> = ({
  courseId,
  courseInstanceId,
  userId,
}) => {
  const { t } = useTranslation()
  const courseQuery = useCourseQuery(courseId)
  const courseInstancesQuery = useCourseInstancesQuery(courseId)
  const userDetailsQuery = useUserDetails(userId)

  if (courseQuery.isError || courseInstancesQuery.isError || userDetailsQuery.isError) {
    return null
  }

  if (
    courseQuery.isPending ||
    courseInstancesQuery.isPending ||
    userDetailsQuery.isPending ||
    !courseQuery.data ||
    !courseInstancesQuery.data ||
    !userDetailsQuery.data
  ) {
    return null
  }

  const courseInstance = courseInstancesQuery.data.find(
    (instance: CourseInstance) => instance.id === courseInstanceId,
  )

  return (
    <CourseInfoBoxContainer>
      <InfoGrid>
        <InfoSection gridArea={GRID_AREAS.COURSE}>
          <InfoLabel>{t("label-course-name")}</InfoLabel>
          <InfoValue>{courseQuery.data.name}</InfoValue>
        </InfoSection>
        {courseInstance && (
          <InfoSection gridArea={GRID_AREAS.INSTANCE}>
            <InfoLabel>{t("course-instance")}</InfoLabel>
            <InfoValue>{courseInstance.name || t("default-instance")}</InfoValue>
          </InfoSection>
        )}
        <InfoSection gridArea={GRID_AREAS.FIRST}>
          <InfoLabel>{t("first-name")}</InfoLabel>
          <InfoValue>{userDetailsQuery.data.first_name}</InfoValue>
        </InfoSection>
        <InfoSection gridArea={GRID_AREAS.LAST}>
          <InfoLabel>{t("last-name")}</InfoLabel>
          <InfoValue>{userDetailsQuery.data.last_name}</InfoValue>
        </InfoSection>
        <InfoSection gridArea={GRID_AREAS.EMAIL}>
          <InfoLabel>{t("label-email")}</InfoLabel>
          <InfoValue>{userDetailsQuery.data.email}</InfoValue>
        </InfoSection>
      </InfoGrid>
    </CourseInfoBoxContainer>
  )
}

export default CourseInstanceUserInfoBox
