"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_query_1 = require("@tanstack/react-query");
var navigation_1 = require("next/navigation");
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var RegisterCompletion_1 = require("@/components/page-specific/register-completion/RegisterCompletion");
var course_modules_1 = require("@/services/backend/course-modules");
var ErrorBanner_1 = require("@/shared-module/common/components/ErrorBanner");
var Spinner_1 = require("@/shared-module/common/components/Spinner");
var LoginStateContext_1 = require("@/shared-module/common/contexts/LoginStateContext");
var withErrorBoundary_1 = require("@/shared-module/common/utils/withErrorBoundary");
var REDIRECT = "redirect";
var CompletionPage = function () {
    var t = (0, react_i18next_1.useTranslation)().t;
    var courseModuleId = (0, navigation_1.useParams)().courseModuleId;
    var pathname = (0, navigation_1.usePathname)();
    var userCompletionInformation = (0, react_query_1.useQuery)({
        queryKey: ["course-module-".concat(courseModuleId, "-completion-information")],
        queryFn: function () { return (0, course_modules_1.fetchUserCompletionInformation)(courseModuleId); },
    });
    if (userCompletionInformation.isSuccess &&
        !userCompletionInformation.data.enable_registering_completion_to_uh_open_university) {
        return (<ErrorBanner_1.default error={t("error-registering-to-the-uh-open-university-not-enabled-for-this-course-module")} variant={"readOnly"}/>);
    }
    return (<>
      {userCompletionInformation.isError && (<ErrorBanner_1.default error={userCompletionInformation.error} variant={"readOnly"}/>)}
      {userCompletionInformation.isLoading && <Spinner_1.default variant={"medium"}/>}
      {userCompletionInformation.isSuccess && (<RegisterCompletion_1.default data={userCompletionInformation.data} registrationFormUrl={"".concat(pathname, "/").concat(REDIRECT)}/>)}
    </>);
};
exports.default = (0, withErrorBoundary_1.default)((0, LoginStateContext_1.withSignedIn)(CompletionPage));
