import React, { useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAdminDashboardData } from "@/features/reports/reportSlice"; // adjust path

import {
  Box,
  SimpleGrid,
  VStack,
  Heading,
  Text,
  Badge,
  Flex,
} from "@chakra-ui/react";
import { Can } from "@/auth/Can";

import ChartCard from "@/components/dashboard/ChartCard";
import KpiCard from "@/components/dashboard/KpiCard";
import ApexLine from "@/components/dashboard/ApexLine";
import ApexBar from "@/components/dashboard/ApexBar";
import AppLoader from "@/components/ui/AppLoader";
import AppError from "@/components/ui/AppError";

const dashboardAdminPayload = {
  meta: {
    generatedAt: "2000-01-07T10:15:00.000Z",
  },
  forms: {
    byStatus: [
      { status: "Draft", count: 0 },
      { status: "Published", count: 0 },
    ],
    accessSummary: [
      {
        formId: 101,
        title: "New Client Intake",
        status: "Published",
        usersWithAccess: 42,
      },
      {
        formId: 102,
        title: "Access Request",
        status: "Published",
        usersWithAccess: 18,
      },
      {
        formId: 103,
        title: "RPA Exception Report",
        status: "Draft",
        usersWithAccess: 6,
      },
      {
        formId: 104,
        title: "Onboarding Checklist",
        status: "Draft",
        usersWithAccess: 3,
      },
    ],
    accessHover: {
      101: { usersWithAccess: 42 },
      102: { usersWithAccess: 18 },
      103: { usersWithAccess: 6 },
      104: { usersWithAccess: 3 },
    },
  },
  responses: {
    byWeek: [
      { bucketStart: "2025-11-18", responsesSubmitted: 61 },
      { bucketStart: "2025-11-25", responsesSubmitted: 74 },
      { bucketStart: "2025-12-02", responsesSubmitted: 52 },
      { bucketStart: "2025-12-09", responsesSubmitted: 88 },
      { bucketStart: "2025-12-16", responsesSubmitted: 95 },
      { bucketStart: "2025-12-23", responsesSubmitted: 69 },
      { bucketStart: "2025-12-30", responsesSubmitted: 77 },
      { bucketStart: "2026-01-06", responsesSubmitted: 41 },
    ],
    byMonth: [
      { bucketStart: "2025-10-01", responsesSubmitted: 220 },
      { bucketStart: "2025-11-01", responsesSubmitted: 284 },
      { bucketStart: "2025-12-01", responsesSubmitted: 336 },
      { bucketStart: "2026-01-01", responsesSubmitted: 91 },
    ],
    sessionsVsResponsesByWeek: [
      {
        bucketStart: "2025-11-18",
        sessionsStarted: 98,
        responsesSubmitted: 61,
      },
      {
        bucketStart: "2025-11-25",
        sessionsStarted: 121,
        responsesSubmitted: 74,
      },
      {
        bucketStart: "2025-12-02",
        sessionsStarted: 89,
        responsesSubmitted: 52,
      },
      {
        bucketStart: "2025-12-09",
        sessionsStarted: 140,
        responsesSubmitted: 88,
      },
      {
        bucketStart: "2025-12-16",
        sessionsStarted: 152,
        responsesSubmitted: 95,
      },
      {
        bucketStart: "2025-12-23",
        sessionsStarted: 111,
        responsesSubmitted: 69,
      },
      {
        bucketStart: "2025-12-30",
        sessionsStarted: 124,
        responsesSubmitted: 77,
      },
      {
        bucketStart: "2026-01-06",
        sessionsStarted: 76,
        responsesSubmitted: 41,
      },
    ],
    completionRateByWeek: [
      {
        bucketStart: "2025-11-18",
        sessionsStarted: 98,
        sessionsCompleted: 61,
        completionRatePercent: 62.24,
      },
      {
        bucketStart: "2025-11-25",
        sessionsStarted: 121,
        sessionsCompleted: 74,
        completionRatePercent: 61.16,
      },
      {
        bucketStart: "2025-12-02",
        sessionsStarted: 89,
        sessionsCompleted: 52,
        completionRatePercent: 58.43,
      },
      {
        bucketStart: "2025-12-09",
        sessionsStarted: 140,
        sessionsCompleted: 88,
        completionRatePercent: 62.86,
      },
      {
        bucketStart: "2025-12-16",
        sessionsStarted: 152,
        sessionsCompleted: 95,
        completionRatePercent: 62.5,
      },
      {
        bucketStart: "2025-12-23",
        sessionsStarted: 111,
        sessionsCompleted: 69,
        completionRatePercent: 62.16,
      },
      {
        bucketStart: "2025-12-30",
        sessionsStarted: 124,
        sessionsCompleted: 77,
        completionRatePercent: 62.1,
      },
      {
        bucketStart: "2026-01-06",
        sessionsStarted: 76,
        sessionsCompleted: 41,
        completionRatePercent: 53.95,
      },
    ],
  },
  files: {
    byWeek: [
      { bucketStart: "2025-11-18", filesUploaded: 18, totalMB: 92.4 },
      { bucketStart: "2025-11-25", filesUploaded: 26, totalMB: 141.2 },
      { bucketStart: "2025-12-02", filesUploaded: 15, totalMB: 64.8 },
      { bucketStart: "2025-12-09", filesUploaded: 31, totalMB: 210.1 },
      { bucketStart: "2025-12-16", filesUploaded: 34, totalMB: 188.6 },
      { bucketStart: "2025-12-23", filesUploaded: 19, totalMB: 102.9 },
      { bucketStart: "2025-12-30", filesUploaded: 22, totalMB: 120.7 },
      { bucketStart: "2026-01-06", filesUploaded: 9, totalMB: 39.3 },
    ],
    byStatus: [
      { status: "stored", count: 132 },
      { status: "pending", count: 7 },
      { status: "failed", count: 2 },
    ],
    topFormsBySize: [
      {
        formId: 101,
        title: "New Client Intake",
        fileCount: 44,
        totalMB: 302.8,
      },
      { formId: 102, title: "Access Request", fileCount: 28, totalMB: 188.1 },
      {
        formId: 104,
        title: "Onboarding Checklist",
        fileCount: 17,
        totalMB: 96.4,
      },
    ],
  },
  users: {
    activeInactive: [
      { isActive: true, count: 34 },
      { isActive: false, count: 6 },
    ],
    byRole: [
      { roleId: 1, roleName: "Admin", roleCode: "admin", usersInRole: 3 },
      {
        roleId: 2,
        roleName: "Form Builder",
        roleCode: "form_builder",
        usersInRole: 6,
      },
      {
        roleId: 3,
        roleName: "Response Viewer",
        roleCode: "response_viewer",
        usersInRole: 12,
      },
      { roleId: 4, roleName: "Basic User", roleCode: "user", usersInRole: 19 },
    ],
    rolesByPermissionCount: [
      { roleId: 1, roleName: "Admin", permissionCount: 24 },
      { roleId: 2, roleName: "Form Builder", permissionCount: 8 },
      { roleId: 3, roleName: "Response Viewer", permissionCount: 4 },
      { roleId: 4, roleName: "Basic User", permissionCount: 2 },
    ],
    topUsersByPermissionCount: [
      {
        userId: 10,
        displayName: "Bruce Aggarwal",
        email: "bruce@company.com",
        isActive: true,
        permissionCount: 24,
      },
      {
        userId: 11,
        displayName: "Asha Singh",
        email: "asha@company.com",
        isActive: true,
        permissionCount: 14,
      },
      {
        userId: 12,
        displayName: "Ravi Kumar",
        email: "ravi@company.com",
        isActive: true,
        permissionCount: 12,
      },
    ],
  },
};

// --------------
// Helpers
// --------------
function fmtBucket(d) {
  return d;
}

function sum(nums) {
  return (nums ?? []).reduce((a, b) => a + (Number(b) || 0), 0);
}

export default function Dashboard() {
  const dispatch = useDispatch();
  const data = useSelector((s) => s.reports.adminDashboard);
  const loading = useSelector((s) => s.reports.loading);
  const error = useSelector((s) => s.reports.error);

  const p = data ?? dashboardAdminPayload;
  useEffect(() => {
    dispatch(getAdminDashboardData());
  }, [dispatch]);

  // ---- KPIs (admin overview) ----
  const totalForms = p.forms.accessSummary.length;
  const publishedForms =
    p.forms.byStatus.find((x) => x.status === "Published")?.count ?? 0;
  const draftForms =
    p.forms.byStatus.find((x) => x.status === "Draft")?.count ?? 0;

  const weeklyResponses = sum(
    p.responses.byWeek.map((x) => x.responsesSubmitted)
  );
  const latestCompletion =
    p.responses.completionRateByWeek.at(-1)?.completionRatePercent ?? 0;

  const totalFiles30ish = sum(p.files.byWeek.map((x) => x.filesUploaded));
  const totalMB30ish = sum(p.files.byWeek.map((x) => x.totalMB));

  const activeUsers =
    p.users.activeInactive.find((x) => x.isActive)?.count ?? 0;
  const inactiveUsers =
    p.users.activeInactive.find((x) => !x.isActive)?.count ?? 0;

  // ---- Charts: categories + series ----
  const formsStatusCategories = useMemo(
    () => p.forms.byStatus.map((x) => x.status),
    [p.forms.byStatus]
  );
  const formsStatusSeries = useMemo(
    () => [{ name: "Forms", data: p.forms.byStatus.map((x) => x.count) }],
    [p.forms.byStatus]
  );

  const formsAccessCategories = useMemo(
    () => p.forms.accessSummary.map((x) => x.title),
    [p.forms.accessSummary]
  );
  const formsAccessSeries = useMemo(
    () => [
      {
        name: "Users with access",
        data: p.forms.accessSummary.map((x) => x.usersWithAccess),
      },
    ],
    [p.forms.accessSummary]
  );

  const responsesWeekCategories = useMemo(
    () => p.responses.byWeek.map((x) => fmtBucket(x.bucketStart)),
    [p.responses.byWeek]
  );
  const responsesWeekSeries = useMemo(
    () => [
      {
        name: "Responses",
        data: p.responses.byWeek.map((x) => x.responsesSubmitted),
      },
    ],
    [p.responses.byWeek]
  );

  const svrWeekCategories = useMemo(
    () =>
      p.responses.sessionsVsResponsesByWeek.map((x) =>
        fmtBucket(x.bucketStart)
      ),
    [p.responses.sessionsVsResponsesByWeek]
  );
  const svrWeekSeries = useMemo(
    () => [
      {
        name: "Sessions started",
        data: p.responses.sessionsVsResponsesByWeek.map(
          (x) => x.sessionsStarted
        ),
      },
      {
        name: "Responses submitted",
        data: p.responses.sessionsVsResponsesByWeek.map(
          (x) => x.responsesSubmitted
        ),
      },
    ],
    [p.responses.sessionsVsResponsesByWeek]
  );

  const completionWeekCategories = useMemo(
    () => p.responses.completionRateByWeek.map((x) => fmtBucket(x.bucketStart)),
    [p.responses.completionRateByWeek]
  );
  const completionWeekSeries = useMemo(
    () => [
      {
        name: "Completion %",
        data: p.responses.completionRateByWeek.map(
          (x) => x.completionRatePercent
        ),
      },
    ],
    [p.responses.completionRateByWeek]
  );

  const filesWeekCategories = useMemo(
    () => p.files.byWeek.map((x) => fmtBucket(x.bucketStart)),
    [p.files.byWeek]
  );
  const filesWeekSeries = useMemo(
    () => [
      {
        name: "Files uploaded",
        data: p.files.byWeek.map((x) => x.filesUploaded),
      },
      { name: "Total MB", data: p.files.byWeek.map((x) => x.totalMB) },
    ],
    [p.files.byWeek]
  );

  const usersActiveCategories = useMemo(
    () =>
      p.users.activeInactive.map((x) => (x.isActive ? "Active" : "Inactive")),
    [p.users.activeInactive]
  );
  const usersActiveSeries = useMemo(
    () => [{ name: "Users", data: p.users.activeInactive.map((x) => x.count) }],
    [p.users.activeInactive]
  );

  const usersByRoleCategories = useMemo(
    () => p.users.byRole.map((x) => x.roleName),
    [p.users.byRole]
  );
  const usersByRoleSeries = useMemo(
    () => [{ name: "Users", data: p.users.byRole.map((x) => x.usersInRole) }],
    [p.users.byRole]
  );
  if (loading && !data) return <AppLoader />;
  if (error && !data) return <AppError />;
  return (
    <Can
      any={["users.read", "roles.read"]}
      fallback={<Box p={6}>No admin access.</Box>}
    >
      <VStack align="stretch" spacing={6}>
        <Flex justify="space-between" align="baseline" gap={3}>
          <Box>
            <Text color="gray.600" mt={1}>
              Generated: {new Date(p.meta.generatedAt).toLocaleString()}
              {" • "}
            </Text>
          </Box>
          <Badge variant="outline">Admin-only</Badge>
        </Flex>

        {/* Top KPIs */}
        <SimpleGrid gap={2} columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <KpiCard
            label="Forms"
            value={totalForms}
            hint={`${publishedForms} Published • ${draftForms} Draft`}
          />
          <KpiCard
            label="Responses "
            value={weeklyResponses}
            hint={"Completed Submissions this week"}
          />
          <KpiCard
            label="Latest completion rate"
            value={`${latestCompletion.toFixed(2)}%`}
            hint="Completion Rate by week"
          />
          <KpiCard
            label="Files uploaded"
            value={totalFiles30ish}
            hint={`${totalMB30ish.toFixed(1)} MB across buckets`}
          />
        </SimpleGrid>

        {/* FORMS SECTION */}
        <Can code="forms.read">
          <Heading size="md">Forms</Heading>
          <SimpleGrid gap={2} columns={{ base: 1, xl: 2 }} spacing={4}>
            <ChartCard
              title="Forms by status"
              subtitle="Draft vs Published. If Draft stays high, your builders are hoarding unfinished work."
              csvRows={p.forms.byStatus.map((x) => ({
                status: x.status,
                count: x.count,
              }))}
              csvFileName="forms_by_status.csv"
              dialogSize="4xl"
            >
              <ApexBar
                categories={formsStatusCategories}
                series={formsStatusSeries}
                height={320}
              />
            </ChartCard>

            <ChartCard
              title="Forms with user access"
              subtitle="Higher count = broader access."
              csvRows={p.forms.accessSummary.map((x) => ({
                form_id: x.formId,
                title: x.title,
                status: x.status,
                users_with_access: x.usersWithAccess,
              }))}
              csvFileName="forms_access_summary.csv"
              dialogSize="6xl"
            >
              {/* NOTE: for “hover count” you already have usersWithAccess.
                  If you want “who has access” on hover, you’ll call:
                  GET /api/forms/:id/access and render a tooltip/popover.
               */}
              <ApexBar
                categories={formsAccessCategories}
                series={formsAccessSeries}
                horizontal
                height={340}
              />
            </ChartCard>
          </SimpleGrid>
        </Can>

        {/* RESPONSES SECTION */}
        <Can code="responses.read">
          <Heading size="md">Responses</Heading>
          <SimpleGrid gap={2} columns={{ base: 1, xl: 2 }} spacing={4}>
            <ChartCard
              title="Responses by week"
              subtitle="Volume trend. Sudden drops mean the form broke or people got blocked."
              csvRows={p.responses.byWeek.map((x) => ({
                week_start: x.bucketStart,
                responses_submitted: x.responsesSubmitted,
              }))}
              csvFileName="responses_by_week.csv"
              dialogSize="6xl"
            >
              <ApexLine
                categories={responsesWeekCategories}
                series={responsesWeekSeries}
                height={320}
              />
            </ChartCard>

            <ChartCard
              title="Sessions started vs responses submitted"
              subtitle="Gap = drop-off. If sessions spike but responses don't, users are abandoning forms."
              csvRows={p.responses.sessionsVsResponsesByWeek.map((x) => ({
                week_start: x.bucketStart,
                sessions_started: x.sessionsStarted,
                responses_submitted: x.responsesSubmitted,
              }))}
              csvFileName="sessions_vs_responses.csv"
              dialogSize="6xl"
            >
              <ApexLine
                categories={svrWeekCategories}
                series={svrWeekSeries}
                height={320}
              />
            </ChartCard>

            <ChartCard
              title="Completion rate by week"
              subtitle="This is your quality meter. Sessions Started v/s Sessions Completed this week"
              csvRows={p.responses.completionRateByWeek.map((x) => ({
                week_start: x.bucketStart,
                sessions_started: x.sessionsStarted,
                sessions_completed: x.sessionsCompleted,
                completion_rate_percent: x.completionRatePercent,
              }))}
              csvFileName="completion_rate_by_week.csv"
              dialogSize="6xl"
            >
              <ApexLine
                categories={completionWeekCategories}
                series={completionWeekSeries}
                height={320}
              />
            </ChartCard>

            <ChartCard
              title="Responses by month"
              subtitle="Bigger picture. Useful for seasonality and whether adoption is real or just a one-week miracle."
              csvRows={p.responses.byMonth.map((x) => ({
                month_start: x.bucketStart,
                responses_submitted: x.responsesSubmitted,
              }))}
              csvFileName="responses_by_month.csv"
              dialogSize="4xl"
            >
              <ApexBar
                categories={p.responses.byMonth.map((x) =>
                  fmtBucket(x.bucketStart)
                )}
                series={[
                  {
                    name: "Responses",
                    data: p.responses.byMonth.map((x) => x.responsesSubmitted),
                  },
                ]}
                height={320}
              />
            </ChartCard>
          </SimpleGrid>
        </Can>

        {/* FILES SECTION */}
        <Heading size="md">Files</Heading>
        <SimpleGrid gap={2} columns={{ base: 1, xl: 2 }} spacing={4}>
          <ChartCard
            title="Files uploaded by week (count + MB)"
            subtitle="Storage pressure + user behavior. If MB grows faster than count, you're getting larger files."
            csvRows={p.files.byWeek.map((x) => ({
              week_start: x.bucketStart,
              files_uploaded: x.filesUploaded,
              total_mb: x.totalMB,
            }))}
            csvFileName="files_by_week.csv"
            dialogSize="6xl"
          >
            <ApexLine
              categories={filesWeekCategories}
              series={filesWeekSeries}
              height={320}
            />
          </ChartCard>

          <ChartCard
            title="Top forms by file size"
            subtitle="Great for cost control and spotting attachment-heavy workflows."
            csvRows={p.files.topFormsBySize.map((x) => ({
              form_id: x.formId,
              title: x.title,
              file_count: x.fileCount,
              total_mb: x.totalMB,
            }))}
            csvFileName="top_forms_by_file_size.csv"
            dialogSize="6xl"
          >
            <ApexBar
              categories={p.files.topFormsBySize.map((x) => x.title)}
              series={[
                {
                  name: "Total MB",
                  data: p.files.topFormsBySize.map((x) => x.totalMB),
                },
                {
                  name: "File count",
                  data: p.files.topFormsBySize.map((x) => x.fileCount),
                },
              ]}
              horizontal
              height={340}
            />
          </ChartCard>
        </SimpleGrid>

        {/* USERS / ROLES / PERMISSIONS SECTION */}
        <Heading size="md">Users, Roles & Permissions</Heading>
        <SimpleGrid gap={2} columns={{ base: 1, xl: 2 }} spacing={4}>
          <ChartCard
            title="Users: active vs inactive"
            subtitle="Inactive users piling up usually means offboarding isn't automated. Shocking."
            csvRows={p.users.activeInactive.map((x) => ({
              status: x.isActive ? "Active" : "Inactive",
              count: x.count,
            }))}
            csvFileName="users_active_inactive.csv"
            dialogSize="4xl"
          >
            <ApexBar
              categories={usersActiveCategories}
              series={usersActiveSeries}
              height={320}
            />
          </ChartCard>

          <ChartCard
            title="Users by role"
            subtitle="Role distribution tells you if permissions are designed or just evolved."
            csvRows={p.users.byRole.map((x) => ({
              role_id: x.roleId,
              role_name: x.roleName,
              role_code: x.roleCode,
              users_in_role: x.usersInRole,
            }))}
            csvFileName="users_by_role.csv"
            dialogSize="6xl"
          >
            <ApexBar
              categories={usersByRoleCategories}
              series={usersByRoleSeries}
              horizontal
              height={340}
            />
          </ChartCard>

          <ChartCard
            title="Roles by permission count"
            subtitle="A role with too many permissions is basically 'Admin Lite' and will ruin your week someday."
            csvRows={p.users.rolesByPermissionCount.map((x) => ({
              role_id: x.roleId,
              role_name: x.roleName,
              permission_count: x.permissionCount,
            }))}
            csvFileName="roles_by_permission_count.csv"
            dialogSize="6xl"
          >
            <ApexBar
              categories={p.users.rolesByPermissionCount.map((x) => x.roleName)}
              series={[
                {
                  name: "Permission count",
                  data: p.users.rolesByPermissionCount.map(
                    (x) => x.permissionCount
                  ),
                },
              ]}
              horizontal
              height={340}
            />
          </ChartCard>

          <ChartCard
            title="Top users by permission count"
            subtitle="This is your 'who can break production with one click' list."
            csvRows={p.users.topUsersByPermissionCount.map((x) => ({
              user_id: x.userId,
              display_name: x.displayName,
              email: x.email,
              is_active: x.isActive,
              permission_count: x.permissionCount,
            }))}
            csvFileName="top_users_by_permission_count.csv"
            dialogSize="6xl"
          >
            <Box bg="gray.50" borderWidth="1px" borderRadius="lg" p={4}>
              {p.users.topUsersByPermissionCount.map((u) => (
                <Flex
                  key={u.userId}
                  justify="space-between"
                  py={2}
                  borderBottomWidth="1px"
                  borderColor="gray.200"
                >
                  <Box>
                    <Text fontWeight="semibold">{u.displayName}</Text>
                    <Text fontSize="sm" color="gray.600">
                      {u.email} • {u.isActive ? "Active" : "Inactive"}
                    </Text>
                  </Box>
                  <Badge>{u.permissionCount} perms</Badge>
                </Flex>
              ))}
            </Box>
          </ChartCard>
        </SimpleGrid>
      </VStack>
    </Can>
  );
}
