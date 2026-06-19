import {
  REGISTER_ROLE_CARDS,
  ROLE_FEATURE_CARDS,
  featureCountForRole,
  roleCardByRegisterRole,
  subscriptionWinsForRole,
} from "../app/lib/roleFeatures";

function fail(message: string): never {
  console.error(`[roleFeatures:check] ${message}`);
  process.exit(1);
}

if (ROLE_FEATURE_CARDS.length !== 4) {
  fail(`ROLE_FEATURE_CARDS length expected 4, got ${ROLE_FEATURE_CARDS.length}`);
}

if (REGISTER_ROLE_CARDS.length !== 3) {
  fail(`REGISTER_ROLE_CARDS length expected 3, got ${REGISTER_ROLE_CARDS.length}`);
}

for (const role of ["student", "teacher", "guardian"] as const) {
  const card = roleCardByRegisterRole(role);
  const actual = featureCountForRole(role);
  if (card.features.length !== actual) {
    fail(`${role} featureCountForRole mismatch`);
  }

  const wins = subscriptionWinsForRole(role);
  if (wins.length < 3) {
    fail(`${role} subscriptionWins expected at least 3 items, got ${wins.length}`);
  }
}

for (const card of ROLE_FEATURE_CARDS) {
  if (card.features.length === 0) fail(`${card.role} has empty features`);
  if (new Set(card.features).size !== card.features.length) {
    fail(`${card.role} has duplicate feature lines`);
  }
  if (!card.href.startsWith("/")) fail(`${card.role} href must be internal path`);
}

const admin = ROLE_FEATURE_CARDS.find((c) => c.role === "Yönetici");
if (!admin || admin.features.length < 10) {
  fail("admin card must expose platform operations list");
}

console.log("[roleFeatures:check] OK", {
  roles: ROLE_FEATURE_CARDS.map((c) => ({ role: c.role, features: c.features.length })),
});
