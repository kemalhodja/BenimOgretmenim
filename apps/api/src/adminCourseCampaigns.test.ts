import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function campaignTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ ok: boolean }>(
    `select to_regclass('public.course_teacher_applications') is not null
        and to_regclass('public.course_student_applications') is not null
        and to_regclass('public.user_notifications') is not null
        and to_regclass('public.course_teacher_payouts') is not null as ok`,
  );
  return r.rows[0]?.ok === true;
}

async function createUser(role: "admin" | "teacher" | "student", suffix: string) {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role) values ($1, $2, $3) returning id`,
    [`admin-course-${role}-${suffix}@example.test`, `Admin Course ${role} ${suffix}`, role],
  );
  const userId = user.rows[0].id;
  let profileId: string | null = null;
  if (role === "teacher") {
    const teacher = await pool.query<{ id: string }>(`insert into teachers (user_id) values ($1) returning id`, [
      userId,
    ]);
    profileId = teacher.rows[0].id;
  }
  if (role === "student") {
    const student = await pool.query<{ id: string }>(`insert into students (user_id) values ($1) returning id`, [
      userId,
    ]);
    profileId = student.rows[0].id;
  }
  const token = await signAccessToken({ userId, role });
  return { userId, profileId, token };
}

describe("admin course campaigns", () => {
  it("lets admin create a course campaign, select a teacher, and collect student pre-registrations", async () => {
    if (!(await campaignTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    let courseId: string | null = null;
    try {
      const admin = await createUser("admin", suffix);
      const teacher = await createUser("teacher", suffix);
      const student = await createUser("student", suffix);
      createdUserIds.push(admin.userId, teacher.userId, student.userId);
      await applyWalletDelta({
        userId: student.userId,
        deltaMinor: 250_000,
        kind: "test_wallet_grant",
        refType: "admin_course_campaign_test",
        refId: suffix,
      });

      const forbiddenCreate = await app.request("http://localhost/v1/admin/courses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Yetkisiz Kampanya",
          studentPriceMinor: 100_000,
          teacherHourlyRateMinor: 50_000,
        }),
      });
      expect(forbiddenCreate.status).toBe(403);

      const create = await app.request("http://localhost/v1/admin/courses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${admin.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Admin LGS Matematik Kampanyası",
          description: "Ön kayıtlı, öğretmen başvurulu yoğun tekrar programı.",
          studentPriceMinor: 250_000,
          teacherHourlyRateMinor: 80_000,
          capacity: 12,
          schedule: { summary: "Pazartesi 19:00" },
          details: { outcomes: ["Problem çözme"], requirements: ["7. veya 8. sınıf"] },
          sessions: [{ scheduledStart: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60 }],
        }),
      });
      expect(create.status).toBe(201);
      const created = (await create.json()) as { course: { id: string; teacher_hourly_rate_minor: number } };
      courseId = created.course.id;
      expect(created.course.teacher_hourly_rate_minor).toBe(80_000);

      const detail = await app.request(`http://localhost/v1/courses/${courseId}`);
      expect(detail.status).toBe(200);
      const detailBody = (await detail.json()) as {
        course: { price_minor: number; teacher_hourly_rate_minor?: unknown; origin: string };
        lessonSchedule: unknown[];
      };
      expect(detailBody.course.origin).toBe("admin_campaign");
      expect(detailBody.course.price_minor).toBe(250_000);
      expect(detailBody.course.teacher_hourly_rate_minor).toBeUndefined();
      expect(detailBody.lessonSchedule.length).toBeGreaterThan(0);

      const waitingBefore = await app.request(
        "http://localhost/v1/admin/courses?origin=admin_campaign&teacherMissing=1",
        { headers: { authorization: `Bearer ${admin.token}` } },
      );
      expect(waitingBefore.status).toBe(200);
      const waitingBeforeBody = (await waitingBefore.json()) as { courses: Array<{ id: string }> };
      expect(waitingBeforeBody.courses.some((course) => course.id === courseId)).toBe(true);

      const teacherApply = await app.request(`http://localhost/v1/courses/${courseId}/teacher-applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Bu kampanyada eğitmen olmak istiyorum." }),
      });
      expect(teacherApply.status).toBe(201);
      const teacherApp = (await teacherApply.json()) as { application: { id: string } };

      const duplicateTeacherApply = await app.request(`http://localhost/v1/courses/${courseId}/teacher-applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Tekrar başvuru." }),
      });
      expect(duplicateTeacherApply.status).toBe(409);

      const accept = await app.request(
        `http://localhost/v1/admin/courses/${courseId}/teacher-applications/${teacherApp.application.id}/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "accepted" }),
        },
      );
      expect(accept.status).toBe(200);

      const teacherNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' = 'course_campaign_teacher_application_decision'
           and payload_jsonb->>'status' = 'accepted'`,
        [teacher.userId],
      );
      expect(teacherNotification.rows[0]?.count).toBe("1");

      const teacherInbox = await app.request("http://localhost/v1/notifications?limit=5", {
        headers: { authorization: `Bearer ${teacher.token}` },
      });
      expect(teacherInbox.status).toBe(200);
      const teacherInboxBody = (await teacherInbox.json()) as {
        notifications: Array<{ payload_jsonb: { kind?: string; status?: string } }>;
      };
      expect(
        teacherInboxBody.notifications.some(
          (notification) =>
            notification.payload_jsonb.kind === "course_campaign_teacher_application_decision" &&
            notification.payload_jsonb.status === "accepted",
        ),
      ).toBe(true);

      const waitingAfter = await app.request(
        "http://localhost/v1/admin/courses?origin=admin_campaign&teacherMissing=1",
        { headers: { authorization: `Bearer ${admin.token}` } },
      );
      expect(waitingAfter.status).toBe(200);
      const waitingAfterBody = (await waitingAfter.json()) as { courses: Array<{ id: string }> };
      expect(waitingAfterBody.courses.some((course) => course.id === courseId)).toBe(false);

      const invalidCohortApply = await app.request(`http://localhost/v1/courses/${courseId}/student-applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ cohortId: randomUUID(), goalNote: "Yanlış cohort ile başvuru." }),
      });
      expect(invalidCohortApply.status).toBe(400);
      const invalidCohortBody = (await invalidCohortApply.json()) as { error: string };
      expect(invalidCohortBody.error).toBe("invalid_campaign_cohort");

      const studentApply = await app.request(`http://localhost/v1/courses/${courseId}/student-applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ goalNote: "LGS için programa katılmak istiyorum." }),
      });
      expect(studentApply.status).toBe(201);

      const duplicateStudentApply = await app.request(`http://localhost/v1/courses/${courseId}/student-applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ goalNote: "Tekrar başvuru." }),
      });
      expect(duplicateStudentApply.status).toBe(409);

      const apps = await app.request(`http://localhost/v1/admin/courses/${courseId}/applications`, {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(apps.status).toBe(200);
      const appsBody = (await apps.json()) as {
        teacherApplications: Array<{ status: string }>;
        studentApplications: Array<{
          id: string;
          status: string;
          wallet_balance_minor: string | number;
          wallet_active_hold_minor: string | number;
          wallet_available_minor: string | number;
        }>;
      };
      expect(appsBody.teacherApplications[0]?.status).toBe("accepted");
      expect(appsBody.studentApplications[0]?.status).toBe("pending");
      expect(String(appsBody.studentApplications[0]?.wallet_balance_minor)).toBe("250000");
      expect(String(appsBody.studentApplications[0]?.wallet_active_hold_minor)).toBe("0");
      expect(String(appsBody.studentApplications[0]?.wallet_available_minor)).toBe("250000");

      const approveStudent = await app.request(
        `http://localhost/v1/admin/courses/${courseId}/student-applications/${appsBody.studentApplications[0].id}/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "approved" }),
        },
      );
      expect(approveStudent.status).toBe(200);
      const approvedStudentBody = (await approveStudent.json()) as {
        application: { status: string };
        enrollment: { id: string } | null;
      };
      expect(approvedStudentBody.application.status).toBe("approved");
      expect(approvedStudentBody.enrollment?.id).toBeTruthy();

      const enrollment = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from course_enrollments
         where student_id = $1
           and metadata_jsonb->>'source' = 'course_campaign_application'
           and metadata_jsonb->>'applicationId' = $2`,
        [student.profileId, appsBody.studentApplications[0].id],
      );
      expect(enrollment.rows[0]?.count).toBe("1");

      const heldEnrollment = await pool.query<{
        id: string;
        cohort_id: string;
        wallet_hold_id: string;
        payment_status: string;
        price_minor: number;
      }>(
        `select id, cohort_id, wallet_hold_id, payment_status, price_minor
         from course_enrollments
         where student_id = $1
           and metadata_jsonb->>'source' = 'course_campaign_application'
           and metadata_jsonb->>'applicationId' = $2`,
        [student.profileId, appsBody.studentApplications[0].id],
      );
      expect(heldEnrollment.rows[0]?.payment_status).toBe("wallet_held");
      expect(Number(heldEnrollment.rows[0]?.price_minor)).toBe(250_000);
      expect(heldEnrollment.rows[0]?.wallet_hold_id).toBeTruthy();
      const walletBeforeStart = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [student.userId],
      );
      expect(walletBeforeStart.rows[0]?.balance_minor).toBe("250000");
      const activeHold = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_wallet_holds
         where id = $1 and user_id = $2 and amount_minor = 250000 and status = 'active'`,
        [heldEnrollment.rows[0].wallet_hold_id, student.userId],
      );
      expect(activeHold.rows[0]?.count).toBe("1");

      const appsAfterApproval = await app.request(`http://localhost/v1/admin/courses/${courseId}/applications`, {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(appsAfterApproval.status).toBe(200);
      const appsAfterApprovalBody = (await appsAfterApproval.json()) as {
        studentApplications: Array<{
          id: string;
          enrollment_payment_status: string | null;
          wallet_hold_status: string | null;
          wallet_hold_amount_minor: string | number | null;
          wallet_balance_minor: string | number;
          wallet_active_hold_minor: string | number;
          wallet_available_minor: string | number;
        }>;
      };
      const approvedApp = appsAfterApprovalBody.studentApplications.find(
        (app) => app.id === appsBody.studentApplications[0].id,
      );
      expect(approvedApp?.enrollment_payment_status).toBe("wallet_held");
      expect(approvedApp?.wallet_hold_status).toBe("active");
      expect(String(approvedApp?.wallet_hold_amount_minor)).toBe("250000");
      expect(String(approvedApp?.wallet_balance_minor)).toBe("250000");
      expect(String(approvedApp?.wallet_active_hold_minor)).toBe("250000");
      expect(String(approvedApp?.wallet_available_minor)).toBe("0");

      const approveStudentAgain = await app.request(
        `http://localhost/v1/admin/courses/${courseId}/student-applications/${appsBody.studentApplications[0].id}/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "approved" }),
        },
      );
      expect(approveStudentAgain.status).toBe(200);
      const enrollmentAfterRepeat = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from course_enrollments
         where student_id = $1
           and metadata_jsonb->>'source' = 'course_campaign_application'
           and metadata_jsonb->>'applicationId' = $2`,
        [student.profileId, appsBody.studentApplications[0].id],
      );
      expect(enrollmentAfterRepeat.rows[0]?.count).toBe("1");
      const activeHoldAfterRepeat = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_wallet_holds
         where user_id = $1 and ref_type = 'course_enrollment' and status = 'active'`,
        [student.userId],
      );
      expect(activeHoldAfterRepeat.rows[0]?.count).toBe("1");

      const studentCourses = await app.request("http://localhost/v1/courses/student/mine", {
        headers: { authorization: `Bearer ${student.token}` },
      });
      expect(studentCourses.status).toBe(200);
      const studentCoursesBody = (await studentCourses.json()) as { enrollments: Array<{ course_id: string }> };
      expect(studentCoursesBody.enrollments.some((row) => row.course_id === courseId)).toBe(true);

      const adminCourseList = await app.request("http://localhost/v1/admin/courses?origin=admin_campaign", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(adminCourseList.status).toBe(200);
      const adminCourseListBody = (await adminCourseList.json()) as {
        courses: Array<{
          id: string;
          student_application_pending_count: number;
          student_application_approved_count: number;
          enrollment_count: number;
          wallet_held_count: number;
          wallet_held_amount_minor: string | number;
          wallet_charged_count: number;
          wallet_charged_amount_minor: string | number;
        }>;
      };
      const listedCampaign = adminCourseListBody.courses.find((course) => course.id === courseId);
      expect(listedCampaign?.student_application_pending_count).toBe(0);
      expect(listedCampaign?.student_application_approved_count).toBe(1);
      expect(listedCampaign?.enrollment_count).toBe(1);
      expect(listedCampaign?.wallet_held_count).toBe(1);
      expect(String(listedCampaign?.wallet_held_amount_minor)).toBe("250000");
      expect(listedCampaign?.wallet_charged_count).toBe(0);
      expect(String(listedCampaign?.wallet_charged_amount_minor)).toBe("0");

      const dueSession = await pool.query<{ id: string }>(
        `update course_sessions
         set scheduled_start = now() - interval '1 minute'
         where cohort_id = $1
         returning id`,
        [heldEnrollment.rows[0].cohort_id],
      );
      const classroomAccess = await app.request(
        `http://localhost/v1/classroom/course-sessions/${dueSession.rows[0].id}`,
        { headers: { authorization: `Bearer ${student.token}` } },
      );
      expect(classroomAccess.status).toBe(200);
      const firstAttendance = await app.request(
        `http://localhost/v1/classroom/course-sessions/${dueSession.rows[0].id}/attendance`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${student.token}`, "content-type": "application/json" },
          body: JSON.stringify({ eventType: "join" }),
        },
      );
      expect(firstAttendance.status).toBe(200);
      const walletAfterStart = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [student.userId],
      );
      expect(walletAfterStart.rows[0]?.balance_minor).toBe("0");
      const chargedEnrollment = await pool.query<{ payment_status: string; count: string }>(
        `select ce.payment_status,
                (select count(*)::text from user_wallet_holds h where h.id = ce.wallet_hold_id and h.status = 'charged') as count
         from course_enrollments ce
         where ce.id = $1`,
        [heldEnrollment.rows[0].id],
      );
      expect(chargedEnrollment.rows[0]?.payment_status).toBe("wallet_charged");
      expect(chargedEnrollment.rows[0]?.count).toBe("1");
      const teacherWalletAfterStart = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(teacherWalletAfterStart.rows[0]?.balance_minor ?? "0").toBe("0");
      const teacherPayout = await pool.query<{ count: string; amount_minor: string; teacher_net_amount_minor: string; refund_lock_status: string }>(
        `select count(*)::text as count,
                coalesce(sum(amount_minor), 0)::text as amount_minor,
                coalesce(sum(teacher_net_amount_minor), 0)::text as teacher_net_amount_minor,
                min(refund_lock_status) as refund_lock_status
         from course_teacher_payouts
         where course_id = $1 and teacher_id = $2 and status = 'pending'`,
        [courseId, teacher.profileId],
      );
      expect(teacherPayout.rows[0]?.count).toBe("1");
      expect(teacherPayout.rows[0]?.amount_minor).toBe("80000");
      expect(teacherPayout.rows[0]?.teacher_net_amount_minor).toBe("72000");
      expect(teacherPayout.rows[0]?.refund_lock_status).toBe("pending_refund_window");
      const teacherPayoutReport = await app.request("http://localhost/v1/wallet/course-payouts", {
        headers: { authorization: `Bearer ${teacher.token}` },
      });
      expect(teacherPayoutReport.status).toBe(200);
      const teacherPayoutReportBody = (await teacherPayoutReport.json()) as {
        payouts: Array<{ course_id: string; amount_minor: number | string; teacher_net_amount_minor: number | string; status: string; refund_lock_status: string }>;
        summary: { paidCount: number; paidAmountMinor: number; pendingCount: number; pendingAmountMinor: number };
      };
      expect(teacherPayoutReportBody.summary.pendingCount).toBeGreaterThanOrEqual(1);
      expect(teacherPayoutReportBody.summary.pendingAmountMinor).toBeGreaterThanOrEqual(72_000);
      const reportedPayout = teacherPayoutReportBody.payouts.find((payout) => payout.course_id === courseId);
      expect(String(reportedPayout?.amount_minor)).toBe("80000");
      expect(String(reportedPayout?.teacher_net_amount_minor)).toBe("72000");
      expect(reportedPayout?.status).toBe("pending");
      expect(reportedPayout?.refund_lock_status).toBe("pending_refund_window");
      const classroomAccessAgain = await app.request(
        `http://localhost/v1/classroom/course-sessions/${dueSession.rows[0].id}`,
        { headers: { authorization: `Bearer ${student.token}` } },
      );
      expect(classroomAccessAgain.status).toBe(200);
      const teacherWalletAfterRepeat = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(teacherWalletAfterRepeat.rows[0]?.balance_minor ?? "0").toBe("0");
      const secondDueSession =
        dueSession.rows[1]?.id ??
        (
          await pool.query<{ id: string }>(
            `insert into course_sessions (cohort_id, session_index, title, scheduled_start, scheduled_end, duration_minutes, status)
             values ($1, 2, 'İkinci ders', now() - interval '1 minute', now() + interval '59 minutes', 60, 'scheduled')
             on conflict (cohort_id, session_index) do update
               set scheduled_start = excluded.scheduled_start,
                   scheduled_end = excluded.scheduled_end
             returning id`,
            [heldEnrollment.rows[0].cohort_id],
          )
        ).rows[0].id;
      const secondClassroomAccess = await app.request(
        `http://localhost/v1/classroom/course-sessions/${secondDueSession}`,
        { headers: { authorization: `Bearer ${student.token}` } },
      );
      expect(secondClassroomAccess.status).toBe(200);
      const secondAttendance = await app.request(
        `http://localhost/v1/classroom/course-sessions/${secondDueSession}/attendance`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${student.token}`, "content-type": "application/json" },
          body: JSON.stringify({ eventType: "join" }),
        },
      );
      expect(secondAttendance.status).toBe(200);
      const teacherWalletAfterSecond = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(teacherWalletAfterSecond.rows[0]?.balance_minor).toBe("144000");
      const chargeNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where student_id = $1
           and payload_jsonb->>'kind' = 'course_enrollment_charge'
           and payload_jsonb->>'amountMinor' = '250000'`,
        [student.profileId],
      );
      expect(chargeNotification.rows[0]?.count).toBe("1");

      const adminCourseListAfterCharge = await app.request("http://localhost/v1/admin/courses?origin=admin_campaign", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(adminCourseListAfterCharge.status).toBe(200);
      const adminCourseListAfterChargeBody = (await adminCourseListAfterCharge.json()) as {
        courses: Array<{
          id: string;
          wallet_held_count: number;
          wallet_held_amount_minor: string | number;
          wallet_charged_count: number;
          wallet_charged_amount_minor: string | number;
          teacher_payout_count: number;
          teacher_payout_amount_minor: string | number;
        }>;
      };
      const listedChargedCampaign = adminCourseListAfterChargeBody.courses.find((course) => course.id === courseId);
      expect(listedChargedCampaign?.wallet_held_count).toBe(0);
      expect(String(listedChargedCampaign?.wallet_held_amount_minor)).toBe("0");
      expect(listedChargedCampaign?.wallet_charged_count).toBe(1);
      expect(String(listedChargedCampaign?.wallet_charged_amount_minor)).toBe("250000");
      expect(listedChargedCampaign?.teacher_payout_count).toBe(2);
      expect(String(listedChargedCampaign?.teacher_payout_amount_minor)).toBe("144000");
      const accounting = await app.request("http://localhost/v1/admin/course-accounting", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(accounting.status).toBe(200);
      const accountingBody = (await accounting.json()) as {
        rows: Array<{
          id: string;
          gross_collected_amount_minor: string | number;
          refunded_amount_minor: string | number;
          teacher_payout_amount_minor: string | number;
          platform_fee_amount_minor: string | number;
          net_platform_amount_minor: string | number;
        }>;
      };
      const accountingRow = accountingBody.rows.find((row) => row.id === courseId);
      expect(String(accountingRow?.gross_collected_amount_minor)).toBe("250000");
      expect(String(accountingRow?.refunded_amount_minor)).toBe("0");
      expect(String(accountingRow?.teacher_payout_amount_minor)).toBe("144000");
      expect(String(accountingRow?.platform_fee_amount_minor)).toBe("16000");
      expect(String(accountingRow?.net_platform_amount_minor)).toBe("16000");

      const appsAfterCharge = await app.request(`http://localhost/v1/admin/courses/${courseId}/applications`, {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(appsAfterCharge.status).toBe(200);
      const appsAfterChargeBody = (await appsAfterCharge.json()) as {
        studentApplications: Array<{ id: string; enrollment_payment_status: string | null; wallet_hold_status: string | null }>;
      };
      const chargedApp = appsAfterChargeBody.studentApplications.find(
        (app) => app.id === appsBody.studentApplications[0].id,
      );
      expect(chargedApp?.enrollment_payment_status).toBe("wallet_charged");
      expect(chargedApp?.wallet_hold_status).toBe("charged");

      const notification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where student_id = $1
           and payload_jsonb->>'kind' = 'course_campaign_application_decision'
           and payload_jsonb->>'status' = 'approved'`,
        [student.profileId],
      );
      expect(Number(notification.rows[0]?.count ?? "0")).toBeGreaterThanOrEqual(1);
    } finally {
      if (courseId) await pool.query(`delete from courses where id = $1`, [courseId]);
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });
});
