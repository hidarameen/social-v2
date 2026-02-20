import { createHashRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LoginPage } from "./components/auth/LoginPage";
import { SignUpPage } from "./components/auth/SignUpPage";
import { ForgotPassword } from "./components/auth/ForgotPassword";
import { EmailVerification } from "./components/auth/EmailVerification";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { DashboardHome } from "./components/dashboard/DashboardHome";
import { AccountsDashboard } from "./components/AccountsDashboard";
import { TasksPage } from "./components/dashboard/TasksPage";
import { ExecutionLog } from "./components/dashboard/ExecutionLog";
import { AnalyticsPageNew } from "./components/dashboard/AnalyticsPageNew";
import { SettingsPageFull } from "./components/dashboard/SettingsPage";
import { ManualPublishPage } from "./components/dashboard/ManualPublishPage";
import { HelpPage } from "./components/dashboard/PlaceholderPages";
import { NotFound } from "./components/NotFound";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

export const router = createHashRouter([
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, Component: WelcomeScreen },
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignUpPage },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "verify-email", Component: EmailVerification },
      {
        path: "dashboard",
        Component: DashboardLayout,
        children: [
          { index: true, Component: DashboardHome },
          { path: "accounts", Component: AccountsDashboard },
          { path: "tasks", Component: TasksPage },
          { path: "manual-publish", Component: ManualPublishPage },
          { path: "executions", Component: ExecutionLog },
          { path: "analytics", Component: AnalyticsPageNew },
          { path: "settings", Component: SettingsPageFull },
          { path: "help", Component: HelpPage },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);
