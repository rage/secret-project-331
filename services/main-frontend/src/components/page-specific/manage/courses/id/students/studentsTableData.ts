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

export const mockStudents: Student[] = Array.from({ length: 5 }).flatMap((_, i) =>
  baseStudents.map((s) => ({
    ...s,
    userId: `${s.userId}-${i + 1}`,
    firstName: `${s.firstName} ${i + 1}`,
  })),
)

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

// === NEW: name formatter + sort comparator + sorted list ===
export const formatName = (s: Student) => `${s.lastName}, ${s.firstName}`

export const byLastThenFirst = (a: Student, b: Student) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)

export const mockStudentsSorted: Student[] = [...mockStudents].sort(byLastThenFirst)

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
        header: `Points / ${chapterMeta.reduce((acc, m) => acc + m.pointsMax, 0)}`,
        accessorKey: "total_points",
      },
      {
        header: `Attempts / ${chapterMeta.reduce((acc, m) => acc + m.attemptsMax, 0)}`,
        accessorKey: "total_attempted",
        meta: { altBg: true },
      },
    ],
  },
  ...chapterMeta.map((meta, idx) => ({
    header: meta.chapter,
    columns: [
      {
        header: `Points / ${meta.pointsMax}`,
        accessorKey: `${["basics", "intermediaries", "advanced", "forbidden", "another1", "another2", "bonus1", "bonus2"][idx]}_points`,
      },
      {
        header: `Attempts / ${meta.attemptsMax}`,
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
    student: formatName(s), // CHANGED
  }

  chapterMeta.forEach((meta, idx) => {
    const keyBase = ["basics","intermediaries","advanced","forbidden","another1","another2","bonus1","bonus2"][idx]
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

// At the end of studentsTableData.ts

export const completionsColumns = [
  { header: "Student", accessorKey: "student" },
  { header: "Default", accessorKey: "default" },
  { header: "Another module", accessorKey: "anotherModule" },
  { header: "Bonus module", accessorKey: "bonusModule" },
]

export const completionsData = mockStudentsSorted.map((s) => ({
  student: formatName(s),
  default: "0/0",
  anotherModule: "0/0",
  bonusModule: "0/0",
}))
