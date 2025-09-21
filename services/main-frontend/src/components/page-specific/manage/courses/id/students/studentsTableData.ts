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

export const completionsColumns = [
  { header: "Student", accessorKey: "student" },
  { header: "Default", accessorKey: "default" },
  { header: "Another module", accessorKey: "anotherModule" },
  { header: "Bonus module", accessorKey: "bonusModule" },
]

export const completionsData = mockStudents.map((s) => ({
  student: `${s.firstName} ${s.lastName}`,
  default: "0/0",
  anotherModule: "0/0",
  bonusModule: "0/0",
}))

export const pointsColumns = [
  {
    header: "Student",
    columns: [{ header: "", accessorKey: "student" }],
  },
  {
    header: "Total",
    columns: [
      { header: "Points / 80", accessorKey: "total_points" },
      { header: "Attempted / 40", accessorKey: "total_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "The Basics",
    columns: [
      { header: "Points / 10", accessorKey: "basics_points" },
      { header: "Attempted / 5", accessorKey: "basics_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "The intermediaries",
    columns: [
      { header: "Points / 10", accessorKey: "intermediaries_points" },
      { header: "Attempted / 5", accessorKey: "intermediaries_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "Advanced studies",
    columns: [
      { header: "Points / 10", accessorKey: "advanced_points" },
      { header: "Attempted / 5", accessorKey: "advanced_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "Forbidden magicks",
    columns: [
      { header: "Points / 10", accessorKey: "forbidden_points" },
      { header: "Attempted / 5", accessorKey: "forbidden_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "Another chapter",
    columns: [
      { header: "Points / 10", accessorKey: "another1_points" },
      { header: "Attempted / 5", accessorKey: "another1_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "Another another chapter",
    columns: [
      { header: "Points / 10", accessorKey: "another2_points" },
      { header: "Attempted / 5", accessorKey: "another2_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "Bonus chapter",
    columns: [
      { header: "Points / 10", accessorKey: "bonus1_points" },
      { header: "Attempted / 5", accessorKey: "bonus1_attempted", meta: { altBg: true } },
    ],
  },
  {
    header: "Another bonus chapter",
    columns: [
      { header: "Points / 10", accessorKey: "bonus2_points" },
      { header: "Attempted / 5", accessorKey: "bonus2_attempted", meta: { altBg: true } },
    ],
  },
]

export const pointsData = mockStudents.map((s) => ({
  student: `${s.firstName} ${s.lastName}`,
  total_points: "0",
  total_attempted: "0",
  basics_points: "0",
  basics_attempted: "0",
  intermediaries_points: "0",
  intermediaries_attempted: "0",
  advanced_points: "0",
  advanced_attempted: "0",
  forbidden_points: "0",
  forbidden_attempted: "0",
  another1_points: "0",
  another1_attempted: "0",
  another2_points: "0",
  another2_attempted: "0",
  bonus1_points: "0",
  bonus1_attempted: "0",
  bonus2_points: "0",
  bonus2_attempted: "0",
}))
