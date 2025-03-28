import React from "react"
import { useTranslation } from "react-i18next"

import {
  CourseManagementPagesProps,
  TabPage,
} from "../../../../../../pages/manage/courses/[id]/[...path]"
import ChatBotPage from "../chatbot/ChatbotPage"
import CourseCheaters from "../cheaters/CourseCheaters"
import CodeGiveawayPage from "../code-giveaway/CodeGiveawayPage"
import CourseGlossary from "../glossary/CourseGlossary"
import References from "../references"
import ResetExercises from "../reset-exercises-tool/ResetExercises"

import useCourseQuery from "@/hooks/useCourseQuery"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"

type AdditionalProps = {
  activeSubtab: string
}

const Subtabs: {
  [key: string]: TabPage
} = {
  references: References,
  glossary: CourseGlossary,
  chatbot: ChatBotPage,
  cheaters: CourseCheaters,
  "code-giveaways": CodeGiveawayPage,
  "exercise-reset-tool": ResetExercises,
}

const Other: React.FC<React.PropsWithChildren<CourseManagementPagesProps & AdditionalProps>> = ({
  courseId,
  activeSubtab,
}) => {
  const { t } = useTranslation()

  const courseQuery = useCourseQuery(courseId)

  const TabComponent = Subtabs[activeSubtab] ?? Subtabs["references"]

  return (
    <div>
      <TabLinkNavigation>
        <TabLink url={"other/references"} isActive={activeSubtab === "references"}>
          {t("references")}
        </TabLink>
        <TabLink url={"other/glossary"} isActive={activeSubtab === "glossary"}>
          {t("link-glossary")}
        </TabLink>
        {courseQuery.data?.can_add_chatbot === true && (
          <TabLink url={"other/chatbot"} isActive={activeSubtab === "chatbot"}>
            {t("chatbot")}
          </TabLink>
        )}
        <TabLink url={"other/cheaters"} isActive={activeSubtab === "cheaters"}>
          {t("link-cheaters")}
        </TabLink>
        <TabLink url={"other/code-giveaways"} isActive={activeSubtab === "code-giveaways"}>
          {t("heading-code-giveaways")}
        </TabLink>
        <TabLink
          url={"other/exercise-reset-tool"}
          isActive={activeSubtab === "exercise-reset-tool"}
        >
          {t("label-exercise-reset-tool")}
        </TabLink>
      </TabLinkNavigation>
      <TabLinkPanel>
        <TabComponent courseId={courseId} />
      </TabLinkPanel>
    </div>
  )
}

export default Other
