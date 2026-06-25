import { processEmailOutbox } from "../lib/emailOutboxProcessor.js";

async function main() {
  const r = await processEmailOutbox(Number(process.env.EMAIL_OUTBOX_BATCH ?? "40"));
  console.log("[email:outbox]", r);
  if (r.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
