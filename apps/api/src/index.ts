import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { pool } from "./db.js";
import type { AppVariables } from "./types.js";
import { auth } from "./routes/auth.js";
import { onboarding } from "./routes/onboarding.js";
import { lessonEvaluations } from "./routes/lessonEvaluations.js";
import { meta } from "./routes/meta.js";
import { teachersPublic } from "./routes/teachersPublic.js";
import { notifications } from "./routes/notifications.js";
import { guardians } from "./routes/guardians.js";
import { curriculum } from "./routes/curriculum.js";
import { teacherMe } from "./routes/teacherMe.js";
import { lessonRequests } from "./routes/lessonRequests.js";
import { subscriptions } from "./routes/subscriptions.js";
import { paytr } from "./routes/paytr.js";
import { packages } from "./routes/packages.js";
import { courses } from "./routes/courses.js";
import { studentPlatform } from "./routes/studentPlatform.js";
import { userWallet } from "./routes/userWallet.js";
import { groupLessons } from "./routes/groupLessons.js";

const app = new Hono<{ Variables: AppVariables }>();

function corsAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ];
}

app.use(
  "/*",
  cors({
    origin: corsAllowedOrigins(),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Secret"],
    exposeHeaders: [],
    maxAge: 86400,
  }),
);

/** Tarayıcıda kök URL — SPA yok; API uçlarını gösterir */
app.get("/", (c) => {
  return c.json({
    service: "BenimÖğretmenim API",
    message:
      "Bu adres yalnızca REST API sunar. Web arayüzü ayrı bir Next.js uygulaması olacak.",
    endpoints: {
      health: "/health",
      auth: "/v1/auth (POST register, login; GET me)",
      meta: "/v1/meta/branches, /v1/meta/cities, /v1/meta/districts?cityId=",
      teachersPublic:
        "/v1/teachers?q=…&branchId=&cityId=, GET /v1/teachers/:teacherId (branşlar + son yorumlar)",
      teacherPanel: "/v1/teacher/me, PATCH /v1/teacher/me, PUT /v1/teacher/me/branches, GET /v1/teacher/dashboard",
      onboarding: "/v1/onboarding/sessions",
      curriculum: "/v1/curriculum/draft, /v1/curriculum/mine",
      lessonEvaluations:
        "/v1/lesson-sessions/reviewable, /my-reviews (GET student), GET|POST /:id/review, POST /:id/evaluation (teacher)",
      lessonRequests:
        "/v1/lesson-requests (student: POST /, GET /mine, POST /:id/cancel, …; teacher: GET /open, GET /my-offers, POST …/offers, POST …/offers/:oid/withdraw, GET|POST /:id/messages)",
      packages:
        "/v1/packages/teacher/mine, /student/mine, GET /:packageId/sessions, POST /:packageId/sessions/:sessionId/schedule",
      courses:
        "/v1/courses (public list), /:id (detail+cohorts), teacher: POST /, GET /mine, PATCH /:id/status, POST /:id/cohorts; student: GET /student/mine, POST /:id/cohorts/:cohortId/enroll",
      studentPlatform:
        "/v1/student-platform/subscription, /homework-posts, /direct-bookings (mine, fund, complete; öğretmen: teacher-mine, complete); öğretmen: /homework-posts/teacher/feed",
      wallet: "/v1/wallet/me, GET /v1/wallet/ledger, POST /v1/wallet/topup; PayTR /v1/paytr/wallet-topup-checkout",
      subscriptions:
        "/v1/subscriptions/plans, /me, POST /purchase; admin: GET /admin/pending-bank-transfers, POST /admin/approve-bank-transfer",
      paytr:
        "/v1/paytr/checkout, /course-checkout, /student-sub-checkout, /wallet-topup-checkout, /callback",
      guardians: "/v1/guardians/overview (GET veli), POST /v1/guardians/link (öğrenci)",
      notifications: "/v1/notifications (GET), PATCH /v1/notifications/:id/read",
    },
  });
});

app.get("/health", async (c) => {
  try {
    const r = await pool.query("select 1 as ok");
    return c.json({ status: "ok", db: r.rows[0]?.ok === 1 });
  } catch (e) {
    return c.json({ status: "degraded", db: false }, 503);
  }
});

app.route("/v1/auth", auth);
app.route("/v1/meta", meta);
app.route("/v1/teachers", teachersPublic);
app.route("/v1/teacher", teacherMe);
app.route("/v1/notifications", notifications);
app.route("/v1/guardians", guardians);
app.route("/v1/curriculum", curriculum);
app.route("/v1/onboarding", onboarding);
app.route("/v1/lesson-sessions", lessonEvaluations);
app.route("/v1/lesson-requests", lessonRequests);
app.route("/v1/packages", packages);
app.route("/v1/courses", courses);
app.route("/v1/student-platform", studentPlatform);
app.route("/v1/wallet", userWallet);
app.route("/v1/group-lessons", groupLessons);
app.route("/v1/subscriptions", subscriptions);
app.route("/v1/paytr", paytr);

app.notFound((c) => {
  return c.json(
    {
      error: "not_found",
      path: c.req.path,
      method: c.req.method,
      hint: "GET / veya GET /health deneyin. Kaynaklar /v1/... altında.",
    },
    404,
  );
});

const port = Number(process.env.PORT ?? "3002");

const server = serve({ fetch: app.fetch, port }, (info) => {
  const p =
    typeof info === "object" && info !== null && "port" in info
      ? (info as { port: number }).port
      : port;
  console.log(`BenimÖğretmenim API http://localhost:${p}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[api] Port ${port} kullanımda. Monorepo kökünde: npm run free-port -- ${port}`,
    );
  } else {
    console.error("[api] Sunucu hatası:", err);
  }
  process.exit(1);
});
