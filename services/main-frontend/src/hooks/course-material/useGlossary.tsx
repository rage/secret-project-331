"use client"
import { useQuery } from "@tanstack/react-query"

import { fetchGlossary } from "@/services/course-material/backend"

interface UseGlossaryOptions {
  enabled?: boolean
}

const useGlossary = (
  courseId: string | null | undefined,
  exam: unknown,
  isMaterialPage: boolean,
  options: UseGlossaryOptions = {},
) => {
  const { enabled = true } = options
  const query = useQuery({
    queryKey: [`glossary-${courseId}`, exam, isMaterialPage],
    queryFn: () => (courseId && exam === null && isMaterialPage ? fetchGlossary(courseId) : []),
    enabled: enabled,
  })
  return query
}

export default useGlossary
