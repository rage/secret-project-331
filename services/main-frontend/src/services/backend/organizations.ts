import { queryOptions } from "@tanstack/react-query"

import {
  getOrganizationActiveCourseCountOptions as getOrganizationActiveCourseCountGeneratedOptions,
  getOrganizationActiveCoursesOptions as getOrganizationActiveCoursesGeneratedOptions,
  getOrganizationBySlugOptions as getOrganizationBySlugGeneratedOptions,
  getOrganizationCourseCountOptions as getOrganizationCourseCountGeneratedOptions,
  getOrganizationCoursesOptions as getOrganizationCoursesGeneratedOptions,
  getOrganizationDuplicatableCoursesOptions as getOrganizationDuplicatableCoursesGeneratedOptions,
  getOrganizationOptions as getOrganizationGeneratedOptions,
  getOrganizationsOptions as getOrganizationsGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getOrganizationActiveCourseCount as getOrganizationActiveCourseCountFromApi,
  getOrganizationActiveCourses as getOrganizationActiveCoursesFromApi,
  getOrganizationBySlug as getOrganizationBySlugFromApi,
  getOrganizationCourseCount as getOrganizationCourseCountFromApi,
  getOrganizationCourses as getOrganizationCoursesFromApi,
  getOrganizationDuplicatableCourses as getOrganizationDuplicatableCoursesFromApi,
  getOrganization as getOrganizationFromApi,
  getOrganizations as getOrganizationsFromApi,
} from "@/generated/api/sdk.generated"
import { Course, CourseCount, Organization } from "@/shared-module/common/bindings"
import { isCourse, isCourseCount, isOrganization } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = await getOrganizationsFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isOrganization))
}

export const getOrganizationsOptions = () =>
  queryOptions({
    ...getOrganizationsGeneratedOptions(),
    select: (data): Organization[] => validateGeneratedData(data, isArray(isOrganization)),
  })

export const fetchOrganization = async (organizationId: string): Promise<Organization> => {
  const data = await getOrganizationFromApi({
    path: {
      organization_id: organizationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isOrganization)
}

export const getOrganizationOptions = (organizationId: string) =>
  queryOptions({
    ...getOrganizationGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
    }),
    select: (data): Organization => validateGeneratedData(data, isOrganization),
  })

export const fetchOrganizationBySlug = async (organizationSlug: string): Promise<Organization> => {
  const data = await getOrganizationBySlugFromApi({
    path: {
      organization_slug: organizationSlug,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isOrganization)
}

export const getOrganizationBySlugOptions = (organizationSlug: string) =>
  queryOptions({
    ...getOrganizationBySlugGeneratedOptions({
      path: {
        organization_slug: organizationSlug,
      },
    }),
    select: (data): Organization => validateGeneratedData(data, isOrganization),
  })

export const fetchOrganizationCourseCount = async (
  organizationId: string,
): Promise<CourseCount> => {
  const data = await getOrganizationCourseCountFromApi({
    path: {
      organization_id: organizationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseCount)
}

export const getOrganizationCourseCountOptions = (organizationId: string) =>
  queryOptions({
    ...getOrganizationCourseCountGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
    }),
    select: (data): CourseCount => validateGeneratedData(data, isCourseCount),
  })

export const fetchOrganizationActiveCourseCount = async (
  organizationId: string,
): Promise<CourseCount> => {
  const data = await getOrganizationActiveCourseCountFromApi({
    path: {
      organization_id: organizationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isCourseCount)
}

export const getOrganizationActiveCourseCountOptions = (organizationId: string) =>
  queryOptions({
    ...getOrganizationActiveCourseCountGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
    }),
    select: (data): CourseCount => validateGeneratedData(data, isCourseCount),
  })

export const fetchOrganizationCourses = async (
  organizationId: string,
  page: number,
  limit: number,
): Promise<Array<Course>> => {
  const data = await getOrganizationCoursesFromApi({
    path: {
      organization_id: organizationId,
    },
    query: {
      page,
      limit,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourse))
}

export const getOrganizationCoursesOptions = (
  organizationId: string,
  page: number,
  limit: number,
) =>
  queryOptions({
    ...getOrganizationCoursesGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
      query: {
        page,
        limit,
      },
    }),
    select: (data): Course[] => validateGeneratedData(data, isArray(isCourse)),
  })

export const fetchOrganizationActiveCourses = async (
  organizationId: string,
  page: number,
  limit: number,
): Promise<Array<Course>> => {
  const data = await getOrganizationActiveCoursesFromApi({
    path: {
      organization_id: organizationId,
    },
    query: {
      page,
      limit,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourse))
}

export const getOrganizationActiveCoursesOptions = (
  organizationId: string,
  page: number,
  limit: number,
) =>
  queryOptions({
    ...getOrganizationActiveCoursesGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
      query: {
        page,
        limit,
      },
    }),
    select: (data): Course[] => validateGeneratedData(data, isArray(isCourse)),
  })

export const fetchOrganizationDuplicatableCourses = async (
  organizationId: string,
): Promise<Array<Course>> => {
  const data = await getOrganizationDuplicatableCoursesFromApi({
    path: {
      organization_id: organizationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourse))
}

export const getOrganizationDuplicatableCoursesOptions = (organizationId: string) =>
  queryOptions({
    ...getOrganizationDuplicatableCoursesGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
    }),
    select: (data): Course[] => validateGeneratedData(data, isArray(isCourse)),
  })
