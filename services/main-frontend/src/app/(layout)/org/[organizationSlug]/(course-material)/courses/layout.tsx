"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import React from "react"

import { getCourseMetadataOptions } from "@/generated/api/@tanstack/react-query.generated"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentCourseIdAtom } from "@/state/course-material/selectors"

function CourseMaterialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Record<string, string | string[] | undefined>>
}) {
  // Suppress unused params warning
  void params

  const courseId = useAtomValue(currentCourseIdAtom)

  const metadataQuery = useQuery({
    ...getCourseMetadataOptions({
      path: {
        course_id: courseId ?? "",
      },
    }),
    enabled: !!courseId,
  })

  const jsonLd = {
    // oxlint-disable-next-line i18next/no-literal-string
    "@context": "https://schema.org",
    // oxlint-disable-next-line i18next/no-literal-string
    "@type": "Course",
    name: metadataQuery.data?.course.name,
    description: metadataQuery.data?.course.description,
    courseCode: metadataQuery.data?.default_module.uh_course_code,
    coursePrerequisites: metadataQuery.data?.course_prerequisites.map(
      (prerequisite) => prerequisite.prerequisite,
    ),
    audience: metadataQuery.data?.course_audiences.map((audience) => ({
      // oxlint-disable-next-line i18next/no-literal-string
      "@type": "EducationalAudience",
      // oxlint-disable-next-line i18next/no-literal-string
      educationalRole: "student",
      audienceType: audience.audience,
    })),
    numberOfCredits: metadataQuery.data?.default_module.ects_credits,
    publisher: {
      // oxlint-disable-next-line i18next/no-literal-string
      "@type": "Organization",
      // oxlint-disable-next-line i18next/no-literal-string
      name: metadataQuery.data?.course_organization.name,
      // oxlint-disable-next-line i18next/no-literal-string
    },
    inLanguage: {
      // oxlint-disable-next-line i18next/no-literal-string
      "@type": "Language",
      alternateName: metadataQuery.data?.course.language_code,
    },
    provider: {
      // oxlint-disable-next-line i18next/no-literal-string
      "@type": "Organization",
      // oxlint-disable-next-line i18next/no-literal-string
      name: "MOOC.fi",
      // oxlint-disable-next-line i18next/no-literal-string
      sameAs: "https://www.mooc.fi/",
    },
    hasCourseInstance: metadataQuery.data?.course_instances.map((instance) => ({
      // oxlint-disable-next-line i18next/no-literal-string
      "@type": "CourseInstance",
      name: instance.name,
      // oxlint-disable-next-line i18next/no-literal-string
      courseMode: ["MOOC", "online"],
      startDate: instance.starts_at,
      endDate: instance.ends_at,
    })),
  }
  return (
    <>
      <section>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c"),
          }}
        />
      </section>
      {children}
    </>
  )
}

export default withErrorBoundary(CourseMaterialLayout)
