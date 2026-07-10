"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import React from "react"

import { getCourseMetadataOptions } from "@/generated/api/@tanstack/react-query.generated"
import Centered from "@/shared-module/common/components/Centering/Centered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentCourseIdAtom } from "@/state/course-material/selectors"

function CourseMaterialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Suppress unused params warning
  void params

  const courseId = useAtomValue(currentCourseIdAtom) ?? ""

  const metadataQuery = useQuery({
    ...getCourseMetadataOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const jsonLd = {
    // eslint-disable-next-line i18next/no-literal-string
    "@context": "https://schema.org",
    // eslint-disable-next-line i18next/no-literal-string
    "@type": "Course",
    name: metadataQuery.data?.course.name,
    description: metadataQuery.data?.course.description,
    courseCode: metadataQuery.data?.default_module.uh_course_code,
    coursePrerequisites: metadataQuery.data?.course_prerequisites.map(
      (prerequisite) => prerequisite.prerequisite,
    ),
    audience: metadataQuery.data?.course_audiences.map((audience) => audience.audience),
    numberOfCredits: metadataQuery.data?.default_module.ects_credits,
    publisher: {
      // eslint-disable-next-line i18next/no-literal-string
      "@type": "Organization",
      // eslint-disable-next-line i18next/no-literal-string
      name: "University of Helsinki",
      // eslint-disable-next-line i18next/no-literal-string
      sameAs: "https://www.helsinki.fi/",
    },
    inLanguage: {
      // eslint-disable-next-line i18next/no-literal-string
      "@type": "Language",
      alternateName: metadataQuery.data?.course.language_code,
    },
    provider: {
      // eslint-disable-next-line i18next/no-literal-string
      "@type": "Organization",
      // eslint-disable-next-line i18next/no-literal-string
      name: "University of Helsinki",
      // eslint-disable-next-line i18next/no-literal-string
      sameAs: "https://www.helsinki.fi/",
    },
    hasCourseInstance: metadataQuery.data?.course_instances.map((instance) => ({
      // eslint-disable-next-line i18next/no-literal-string
      "@type": "CourseInstance",
      name: instance.name,
      // eslint-disable-next-line i18next/no-literal-string
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
      <Centered variant="narrow">{children}</Centered>
    </>
  )
}

export default withErrorBoundary(CourseMaterialLayout)
