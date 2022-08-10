/* eslint-disable i18next/no-literal-string */
import { PageInfo } from "../bindings"

export function pageRoute(pageInfo: PageInfo, urlPath: string): string {
  return `/org/${pageInfo.organization_slug}/courses/${pageInfo.course_slug}${urlPath}`
}
