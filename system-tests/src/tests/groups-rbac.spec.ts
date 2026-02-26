import { BrowserContext, expect, Page, test } from "@playwright/test"

import { hideToasts, waitForSuccessNotification } from "../utils/notificationUtils"

import { manageOrganization } from "@/utils/organizationUtils"

const ORG_NAME = "University of Helsinki, Department of Computer Science"
const PERMISSION_MANAGEMENT_COURSE_ID = "a2002fc3-2c87-4aae-a5e5-9d14617aad2b"
const COURSE_MANAGE_ROUTE = `http://project-331.local/manage/courses/${PERMISSION_MANAGEMENT_COURSE_ID}`
const COURSE_PERMISSIONS_ROUTE = `${COURSE_MANAGE_ROUTE}/permissions`

async function waitForAnyToast(page: Page, action: () => Promise<void>) {
  await hideToasts(page)
  await action()
  await page.getByTestId("toast-notification").first().waitFor()
  await hideToasts(page)
}

async function gotoOrganizationGroupsPage(page: Page) {
  await page.goto("http://project-331.local/organizations")
  await manageOrganization(page, ORG_NAME)
  await page.getByRole("link", { name: "Groups" }).click()
  await page.getByRole("heading", { name: /Groups for organization/i }).waitFor()
}

async function createGroupFromGroupsPage(page: Page, groupName: string): Promise<string> {
  await page.getByLabel("Group name").fill(groupName)
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Create group" }).click()
  })

  const groupLink = page.getByRole("link", { name: new RegExp(groupName) }).first()
  await expect(groupLink).toBeVisible()
  const groupHref = groupLink
  await expect(groupHref).toHaveAttribute("href")
  await groupLink.click()
  await page.getByRole("heading", { name: groupName }).waitFor()

  return `http://project-331.local${groupHref}`
}

function membersSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Group members" }),
  })
}

function rolesSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Group role assignments" }),
  })
}

async function addGroupMemberByEmail(page: Page, email: string) {
  const section = membersSection(page)
  await section.getByLabel("Email").fill(email)
  await waitForSuccessNotification(page, async () => {
    await section.getByRole("button", { name: "Add member" }).click()
  })
  await expect(section.getByText(email)).toBeVisible()
}

async function removeGroupMemberByEmail(page: Page, email: string) {
  const section = membersSection(page)
  const memberCard = section.locator("div").filter({ hasText: email }).first()

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain(email)
    void dialog.accept()
  })
  await waitForAnyToast(page, async () => {
    await memberCard.getByRole("button", { name: "Remove" }).click()
  })
  await expect(section.getByText(email)).toHaveCount(0)
}

async function addCourseScopedGroupRole(
  page: Page,
  role: "Teacher" | "Assistant",
  courseId: string,
) {
  const section = rolesSection(page)
  await section.getByLabel("Role").selectOption(role)
  await section.getByLabel("Scope type").selectOption("Course")
  await section.getByLabel("Scope ID").fill(courseId)

  await waitForSuccessNotification(page, async () => {
    await section.getByRole("button", { name: "Add group role" }).click()
  })

  await expect(section.getByText(role, { exact: true })).toBeVisible()
}

async function deleteCurrentGroup(page: Page) {
  page.once("dialog", (dialog) => dialog.accept())
  await waitForAnyToast(page, async () => {
    await page.getByRole("button", { name: "Delete group" }).click()
  })
  await expect(page).toHaveURL(/\/manage\/organizations\/[^/]+\/groups$/)
}

test.describe("RBAC groups (system)", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test.describe.configure({ mode: "serial" })

  let student1Context: BrowserContext
  let student2Context: BrowserContext

  test.beforeEach(async ({ browser }) => {
    student1Context = await browser.newContext({
      storageState: "src/states/student1@example.com.json",
    })
    student2Context = await browser.newContext({
      storageState: "src/states/student2@example.com.json",
    })
  })

  test.afterEach(async () => {
    await student1Context.close()
    await student2Context.close()
  })

  test("group course role grants and revokes course management access end-to-end", async ({
    page,
  }) => {
    const student1Page = await student1Context.newPage()
    const groupName = `RBAC Course Group ${Date.now()}`

    await test.step("Student cannot manage the seeded permission-management course initially", async () => {
      await student1Page.goto(COURSE_MANAGE_ROUTE)
      await student1Page.getByText("Unauthorized").first().waitFor()
    })

    let groupUrl = ""
    await test.step("Admin creates a group, adds student1, and grants a course-scoped Teacher role", async () => {
      await gotoOrganizationGroupsPage(page)
      groupUrl = await createGroupFromGroupsPage(page, groupName)
      await addGroupMemberByEmail(page, "student1@example.com")
      await addCourseScopedGroupRole(page, "Teacher", PERMISSION_MANAGEMENT_COURSE_ID)
    })

    await test.step("Course permission page shows groups with access and links to the group page", async () => {
      await page.goto(COURSE_PERMISSIONS_ROUTE)
      await expect(page.getByRole("heading", { name: "Groups with access" })).toBeVisible()

      const groupLink = page.getByRole("link", { name: groupName })
      await expect(groupLink).toBeVisible()

      const groupRow = page.locator("tr").filter({ has: groupLink }).first()
      await expect(groupRow.getByText("Teacher", { exact: true })).toBeVisible()
      await expect(groupRow.getByText("1", { exact: true })).toBeVisible()

      await groupLink.click()
      await expect(page).toHaveURL(new RegExp(`/manage/organizations/.+/groups/.+`))
      await expect(page.getByRole("heading", { name: groupName })).toBeVisible()
      await expect(page.getByText("student1@example.com")).toBeVisible()
    })

    await test.step("Student gains course management access via the group role", async () => {
      await student1Page.goto(COURSE_MANAGE_ROUTE)
      await expect(student1Page.getByText("Unauthorized")).toHaveCount(0)
      await expect(student1Page.getByText("Permissions")).toBeVisible()
    })

    await test.step("Deleting the group removes the granted course management access immediately", async () => {
      await page.goto(groupUrl)
      await expect(page.getByRole("heading", { name: groupName })).toBeVisible()
      await deleteCurrentGroup(page)

      await student1Page.goto(COURSE_MANAGE_ROUTE)
      await student1Page.getByText("Unauthorized").first().waitFor()
    })
  })

  test("group member can rename and manage memberships but cannot manage group roles without role-management permission", async ({
    page,
  }) => {
    const student1Page = await student1Context.newPage()
    const groupName = `RBAC Member Group ${Date.now()}`
    const renamedGroupName = `${groupName} Renamed`

    let groupUrl = ""
    await test.step("Admin creates a group and adds student1 as a member", async () => {
      await gotoOrganizationGroupsPage(page)
      groupUrl = await createGroupFromGroupsPage(page, groupName)
      await addGroupMemberByEmail(page, "student1@example.com")
    })

    await test.step("Group member can rename the group and manage members", async () => {
      await student1Page.goto(groupUrl)
      await expect(student1Page.getByRole("heading", { name: groupName })).toBeVisible()

      await expect(student1Page.getByRole("button", { name: "Rename group" })).toBeVisible()
      await expect(student1Page.getByRole("button", { name: "Delete group" })).toBeVisible()

      await student1Page.getByLabel("Group name").fill(renamedGroupName)
      await waitForSuccessNotification(student1Page, async () => {
        await student1Page.getByRole("button", { name: "Rename group" }).click()
      })
      await expect(student1Page.getByRole("heading", { name: renamedGroupName })).toBeVisible()

      await addGroupMemberByEmail(student1Page, "student2@example.com")
      await removeGroupMemberByEmail(student1Page, "student2@example.com")
    })

    await test.step("Group member cannot manage group roles without independent role-management permission", async () => {
      await expect(
        student1Page.getByText(
          "You can view group roles, but you do not have permission to manage them.",
        ),
      ).toBeVisible()
      await expect(student1Page.getByRole("button", { name: "Add group role" })).toHaveCount(0)
    })

    await test.step("Group member can delete their own group", async () => {
      await deleteCurrentGroup(student1Page)
      await expect(student1Page.getByText("Showing only groups you belong to.")).toBeVisible()
      await expect(student1Page.getByText(renamedGroupName)).toHaveCount(0)
    })
  })
})
