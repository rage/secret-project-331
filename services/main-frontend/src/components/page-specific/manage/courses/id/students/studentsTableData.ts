// studentsTableData.ts

export type Student = {
  firstName: string
  lastName: string
  userId: string
  email: string
  courseInstance: string
}

export const baseStudents: Student[] = [
  {
    firstName: "Henrik",
    lastName: "Williams",
    userId: "02364d40-2aac-4763-8a06-2381fd298d79",
    email: "wood.krank@gmail.com",
    courseInstance: "Finnish",
  },
  {
    firstName: "Jennifer",
    lastName: "Williams",
    userId: "abc123-def456",
    email: "jen.williams@gmail.com",
    courseInstance: "English",
  },
  {
    firstName: "Mikka",
    lastName: "Williams",
    userId: "ghi789-jkl012",
    email: "mikka.williams@gmail.com",
    courseInstance: "Polish",
  },
  {
    firstName: "Greg",
    lastName: "Williams",
    userId: "mno345-pqr678",
    email: "greg@gmail.com",
    courseInstance: "Swedish",
  },
]

const badStudents: Student[] = [
  {
    firstName: null,
    lastName: null,
    userId: "bad-001",
    email: "unknown1@example.com",
    courseInstance: "Unknown",
  },
  {
    firstName: "",
    lastName: null,
    userId: "bad-002",
    email: "unknown2@example.com",
    courseInstance: "Unknown",
  },
  {
    firstName: "NoLastName",
    lastName: "",
    userId: "bad-003",
    email: "unknown3@example.com",
    courseInstance: "Unknown",
  },
]

export const mockStudents: Student[] = Array.from({ length: 5 }).flatMap((_, i) =>
  baseStudents.map((s) => ({
    ...s,
    userId: `${s.userId}-${i + 1}`,
    firstName: `${s.firstName} ${i + 1}`,
  })),
)

const allStudents: Student[] = [...badStudents, ...mockStudents]

// --- RANDOMIZED CHAPTER MAX VALUES ---
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Define chapter structure (titles)
const chapterDefs = [
  "The Basics",
  "The intermediaries",
  "Advanced studies",
  "Forbidden magicks",
  "Another chapter",
  "Another another chapter",
  "Bonus chapter",
  "Another bonus chapter",
]

// Generate random max values for each chapter (points and attempts)
const chapterMeta = chapterDefs.map((chapter) => {
  const pointsMax = randInt(10, 250)
  const attemptsMax = randInt(3, 15)
  return { chapter, pointsMax, attemptsMax }
})

// --- Name formatter ---
export const formatName = (s: Student) => {
  const first = s.firstName?.trim()
  const last = s.lastName?.trim()
  if (!first && !last) {
    return "(Missing Name)"
  }
  if (!last) {
    return first ?? "(Missing Name)"
  }
  if (!first) {
    return last ?? "(Missing Name)"
  }
  return `${last}, ${first}`
}

// --- Sort: missing names come first ---
export const byLastThenFirst = (a: Student, b: Student) => {
  const aMissing = !a.firstName || !a.lastName
  const bMissing = !b.firstName || !b.lastName
  if (aMissing && !bMissing) {
    return -1
  }
  if (!aMissing && bMissing) {
    return 1
  }

  const lastCmp = (a.lastName ?? "").localeCompare(b.lastName ?? "")
  if (lastCmp !== 0) {
    return lastCmp
  }
  return (a.firstName ?? "").localeCompare(b.firstName ?? "")
}

// --- Sorted list ---
export const mockStudentsSorted: Student[] = [...allStudents].sort(byLastThenFirst)

// --- BUILD COLUMNS ---
export const pointsColumns = [
  {
    header: "Student",
    columns: [{ header: "", accessorKey: "student" }],
  },
  {
    header: "Total",
    columns: [
      {
        header: `Points /${chapterMeta.reduce((acc, m) => acc + m.pointsMax, 0)}`,
        accessorKey: "total_points",
      },
      {
        header: `Attempts /${chapterMeta.reduce((acc, m) => acc + m.attemptsMax, 0)}`,
        accessorKey: "total_attempted",
        meta: { altBg: true },
      },
    ],
  },
  ...chapterMeta.map((meta, idx) => ({
    header: meta.chapter,
    columns: [
      {
        header: `Points /${meta.pointsMax}`,
        accessorKey: `${["basics", "intermediaries", "advanced", "forbidden", "another1", "another2", "bonus1", "bonus2"][idx]}_points`,
      },
      {
        header: `Attempts /${meta.attemptsMax}`,
        accessorKey: `${["basics", "intermediaries", "advanced", "forbidden", "another1", "another2", "bonus1", "bonus2"][idx]}_attempted`,
        meta: { altBg: true },
      },
    ],
  })),
]

// --- BUILD STUDENT DATA ---
export const pointsData = mockStudentsSorted.map((s) => {
  let totalPoints = 0
  let totalAttempted = 0
  const obj: any = {
    student: formatName(s),
  }

  chapterMeta.forEach((meta, idx) => {
    const keyBase = [
      "basics",
      "intermediaries",
      "advanced",
      "forbidden",
      "another1",
      "another2",
      "bonus1",
      "bonus2",
    ][idx]
    const pointsKey = `${keyBase}_points`
    const attKey = `${keyBase}_attempted`
    const points = randInt(0, meta.pointsMax)
    const attempts = randInt(0, meta.attemptsMax)
    obj[pointsKey] = points
    obj[attKey] = attempts
    totalPoints += points
    totalAttempted += attempts
  })

  obj["total_points"] = totalPoints
  obj["total_attempted"] = totalAttempted
  return obj
})

// --- MODULE DEFINITIONS FOR COMPLETIONS ---
const moduleDefs = [
  "Default",
  "Another module",
  "Bonus module",
  "Bonus module",
  "Bonus module",
  "Bonus module",
  "Bonus module",
]

// 👇 fixed widths for leaf columns (per module)
export const COMPLETIONS_COL_WIDTH = 120 // px; tweak if you like

// Completions columns: Student + each Module with two subcolumns (Grade, Status)
export const completionsColumns = [
  {
    header: "Student",
    columns: [{ header: "", accessorKey: "student" }], // Student stays free-width
  },
  ...moduleDefs.map((name, idx) => ({
    header: name,
    columns: [
      {
        header: "Grade",
        accessorKey: `module${idx + 1}_grade`,
        meta: { width: COMPLETIONS_COL_WIDTH },
      },
      {
        header: "Status",
        accessorKey: `module${idx + 1}_status`,
        meta: { width: COMPLETIONS_COL_WIDTH, altBg: true },
      },
    ],
  })),
]

// Completions data: 0–5 OR "Accepted"/"Failed"
type Grade = 0 | 1 | 2 | 3 | 4 | 5 | "Accepted" | "Failed"
const gradePool: Grade[] = [0, 1, 2, 3, 4, 5, "Accepted", "Failed"]
const statusPool = ["Registered", "-"] as const

export const completionsData = mockStudentsSorted.map((s, i) => {
  const obj: any = { student: formatName(s) }

  moduleDefs.forEach((_, idx) => {
    obj[`module${idx + 1}_grade`] = gradePool[(i + idx) % gradePool.length]
    obj[`module${idx + 1}_status`] = statusPool[(i + idx) % statusPool.length]
  })

  return obj
})
