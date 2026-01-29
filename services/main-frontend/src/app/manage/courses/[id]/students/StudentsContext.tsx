"use client"

import React, { createContext, useContext, useState, useTransition } from "react"

interface StudentsContextValue {
  courseId: string
  searchQuery: string
  setSearchQuery: (value: string) => void
  inputValue: string
  setInputValue: (value: string) => void
  startTransition: (fn: () => void) => void
}

const StudentsContext = createContext<StudentsContextValue | null>(null)

export function useStudentsContext() {
  const ctx = useContext(StudentsContext)
  if (!ctx) {
    throw new Error("useStudentsContext must be used within StudentsLayout")
  }
  return ctx
}

export function StudentsContextProvider({
  courseId,
  children,
}: {
  courseId: string
  children: React.ReactNode
}) {
  const [inputValue, setInputValue] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [_, startTransition] = useTransition()

  const setSearch = (value: string) => {
    setInputValue(value)
    startTransition(() => setSearchQuery(value))
  }

  const value: StudentsContextValue = {
    courseId,
    searchQuery,
    setSearchQuery: setSearch,
    inputValue,
    setInputValue,
    startTransition,
  }

  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
}
