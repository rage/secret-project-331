import { css } from "@emotion/react"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import React, { useState } from "react"

const headerTopRowStyle = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
`
const headerTitleWrapStyle = css`
  flex: 1 1 auto;
  min-width: 0;
`
const dropdownTopStyle = css`
  background: #fff;
  border: 1px solid #e4e5e8;
  border-radius: 2px;
  width: 170px;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-size: 14px;
  color: #1a2333;
  cursor: pointer;
  margin-left: 24px;
  margin-top: 0;
  white-space: nowrap;
`

const pageHeaderStyle = css`
  width: 1124px;
  margin: 32px auto 0 auto;
`

const titleStyle = css`
  font-family: "Inter", sans-serif;
  font-weight: 500;
  font-size: 24px;
  line-height: 29px;
  color: #1a2333;
  margin-bottom: 8px;
`

const chatbotInfoStyle = css`
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 140%;
  color: #1a2333;
  opacity: 0.9;
  margin-bottom: 24px;
  max-width: 700px;
`

const dividerStyle = css`
  border: none;
  border-top: 2px solid rgba(206, 209, 215, 0.5);
  margin-bottom: 28px;
`

const controlsRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
`

const dropdownIconStyle = css`
  margin-left: auto;
  color: #4e5562;
  font-size: 18px;
  transform: rotate(180deg);
`

const searchBoxWrapStyle = css`
  position: relative;
  width: 370px;
  height: 36px;
  margin-right: 18px;
`

const searchInputStyle = css`
  width: 100%;
  height: 36px;
  border: 1px solid #dbdbdb;
  border-radius: 4px;
  padding-left: 36px;
  font-size: 14px;
  font-family: "Inter", sans-serif;
  color: #1a2333;
  background: #fff;
`

const searchIconStyle = css`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #5c5f64;
  font-size: 16px;
  opacity: 0.8;
`

const tabsWrapStyle = css`
  display: flex;
  align-items: center;
  background: rgba(6, 88, 83, 0.05);
  border-radius: 2px;
  height: 36px;
  border: 1px solid #dbdbdb;
  overflow: hidden;
  min-width: 0;
`

const tabStyle = (active = false, color = "#1A2333", isLast = false) => css`
  padding: 0 20px;
  height: 36px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-family: "Inter", sans-serif;
  font-weight: 400;
  color: ${active ? "#065853" : color};
  background: ${active ? "#fff" : "transparent"};
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  ${!isLast && "border-right: 1px solid #dbdbdb;"}
`

const containerStyle = css`
  width: 1124px;
  height: 400px; /* or whatever fixed height you want */
  margin: 0 auto 0 auto;
  background: #fff;
  border: 1px solid #ced1d7;
  border-radius: 8px 8px 0 0;
  font-family: "Inter", sans-serif;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const tableStyle = css`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
`

const headerRowStyle = css`
  background: #f7f8f9;
  height: 48px;
`

const thStyle = css`
  color: #1a2333;
  opacity: 0.8;
  font-weight: 500;
  font-size: 14px;
  line-height: 140%;
  padding-left: 24px;
  text-align: left;
  height: 48px;
  background: #f7f8f9;
  border-bottom: 1px solid #ced1d7;
  vertical-align: middle;
  &:first-of-type {
    border-radius: 7px 0 0 0;
  }
  &:last-of-type {
    border-radius: 0 7px 0 0;
  }
`

const rowStyle = css`
  height: 50px;
`

const tdStyle = css`
  color: #1a2333;
  opacity: 0.8;
  font-weight: 400;
  font-size: 14px;
  line-height: 140%;
  padding-left: 24px;
  height: 50px;
  vertical-align: middle;
  background: #fff;
  border-bottom: 1px solid #ced1d7;
`

const firstNameSpecialStyle = css`
  color: #d72f29;
`

const lastRowTdStyle = css`
  border-bottom: none;
`

const thStickyStyle = css`
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f7f8f9;
  ${thStyle};
`

const innerScrollStyle = css`
  flex: 1 1 auto;
  overflow-y: auto;
  width: 100%;
`

// ---- MOCK DATA ----
type Student = {
  firstName: string
  lastName: string
  userId: string
  email: string
  courseInstance: string
}

const baseStudents: Student[] = [
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

// Repeat 5x for demo (will result in 20 rows)
const mockStudents: Student[] = Array.from({ length: 5 }).flatMap((_, i) =>
  baseStudents.map((s, j) => ({
    ...s,
    userId: `${s.userId}-${i + 1}`,
    firstName: `${s.firstName} ${i + 1}`,
  })),
)

// ---- TANSTACK TABLE DATA ----
const completionsColumns = [
  { header: "Student", accessorKey: "student" },
  { header: "Default", accessorKey: "default" },
  { header: "Another module", accessorKey: "anotherModule" },
  { header: "Bonus module", accessorKey: "bonusModule" },
]

const completionsData = mockStudents.map((s) => ({
  student: `${s.firstName} ${s.lastName}`,
  default: "0/0",
  anotherModule: "0/0",
  bonusModule: "0/0",
}))

const pointsColumns = [
  { header: "Student", accessorKey: "student" },
  { header: "The Basics", accessorKey: "basics" },
  { header: "The intermediaries", accessorKey: "intermediaries" },
  { header: "Advanced studies", accessorKey: "advanced" },
  { header: "Forbidden magicks", accessorKey: "forbidden" },
  { header: "Another chapter", accessorKey: "another1" },
  { header: "Another another chapter", accessorKey: "another2" },
  { header: "Bonus chapter", accessorKey: "bonus1" },
  { header: "Another bonus chapter", accessorKey: "bonus2" },
]

const pointsData = mockStudents.map((s) => ({
  student: `${s.firstName} ${s.lastName}`,
  basics: "0/0",
  intermediaries: "0/0",
  advanced: "0/0",
  forbidden: "0/0",
  another1: "0/0",
  another2: "0/0",
  bonus1: "0/0",
  bonus2: "0/0",
}))

const UserTabContent = () => (
  <div css={innerScrollStyle}>
    <table css={tableStyle}>
      <thead>
        <tr css={headerRowStyle}>
          <th css={thStickyStyle}>First Name</th>
          <th css={thStickyStyle}>Last Name</th>
          <th css={thStickyStyle}>User ID</th>
          <th css={thStickyStyle}>Email</th>
          <th css={thStickyStyle}>Course Instance</th>
        </tr>
      </thead>
      <tbody>
        {mockStudents.map((student, i) => {
          const isLast = i === mockStudents.length - 1
          return (
            <tr key={student.userId} css={rowStyle}>
              <td css={[tdStyle, i === 0 && firstNameSpecialStyle, isLast && lastRowTdStyle]}>
                {student.firstName}
              </td>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>{student.lastName}</td>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>{student.userId}</td>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>{student.email}</td>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>{student.courseInstance}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

const CertificatesTabContent = () => (
  <div css={innerScrollStyle}>
    <table css={tableStyle}>
      <thead>
        <tr css={headerRowStyle}>
          <th css={thStickyStyle}>Student</th>
          <th css={thStickyStyle}>Certificate</th>
          <th css={thStickyStyle}>Date Issued</th>
        </tr>
      </thead>
      <tbody>
        {mockStudents.map((student, i) => {
          const isLast = i === mockStudents.length - 1
          return (
            <tr key={student.userId} css={rowStyle}>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>
                {student.firstName} {student.lastName}
              </td>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>
                {i % 2 === 0 ? "Course Certificate" : "No Certificate"}
              </td>
              <td css={[tdStyle, isLast && lastRowTdStyle]}>{i % 2 === 0 ? "2025-09-02" : "-"}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

const TableContainer = (props: { children: React.ReactNode }) => (
  <div css={innerScrollStyle}>{props.children}</div>
)

function TanStackTable<T>({ columns, data }: { columns: any[]; data: T[] }) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <TableContainer>
      <table css={tableStyle}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} css={headerRowStyle}>
              {headerGroup.headers.map((header, i) => (
                <th
                  key={header.id}
                  css={thStickyStyle}
                  style={{
                    left: undefined,
                    minWidth: 150,
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} css={rowStyle}>
              {row.getVisibleCells().map((cell, i) => {
                const isLast = row.index === data.length - 1
                return (
                  <td key={cell.id} css={[tdStyle, isLast && lastRowTdStyle]}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  )
}

const CompletionsTabContent = () => (
  <TanStackTable columns={completionsColumns} data={completionsData} />
)

const PointsTabContent = () => <TanStackTable columns={pointsColumns} data={pointsData} />

// ---- MAIN PAGE ----

const TAB_USER = "User"
const TAB_COMPLETIONS = "Completions"
const TAB_POINTS = "Points"
const TAB_CERTIFICATES = "Certificates"

const TAB_LIST = [TAB_USER, TAB_COMPLETIONS, TAB_POINTS, TAB_CERTIFICATES]

const tabContentMap: { [k: string]: React.ReactNode } = {
  [TAB_USER]: <UserTabContent />,
  [TAB_COMPLETIONS]: <CompletionsTabContent />,
  [TAB_POINTS]: <PointsTabContent />,
  [TAB_CERTIFICATES]: <CertificatesTabContent />,
}

const StudentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(TAB_USER)

  return (
    <div>
      {/* HEADER SECTION */}
      <div css={pageHeaderStyle}>
        <div css={headerTopRowStyle}>
          <div css={headerTitleWrapStyle}>
            <div css={titleStyle}>Students</div>
            <div css={chatbotInfoStyle}>
              Enabling the chatbot will allow automated assistance for students, providing instant
              responses to common questions and guidance throughout the course. You can disable it
              at any time in the settings.
            </div>
          </div>
          <div css={dropdownTopStyle}>
            All instances
            <span css={dropdownIconStyle}>▼</span>
          </div>
        </div>
        <hr css={dividerStyle} />

        <div css={controlsRowStyle}>
          <div css={searchBoxWrapStyle}>
            <input css={searchInputStyle} placeholder="Search student..." />
            <span css={searchIconStyle}>🔍</span>
          </div>
          <div css={tabsWrapStyle}>
            {TAB_LIST.map((tab, i) => (
              <button
                key={tab}
                css={tabStyle(
                  activeTab === tab,
                  tab === TAB_COMPLETIONS ? "#065853" : "#1A2333",
                  i === TAB_LIST.length - 1,
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div css={containerStyle}>{tabContentMap[activeTab]}</div>
    </div>
  )
}

export default StudentsPage
