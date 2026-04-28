import { serve } from "@hono/node-server";
import { app } from "./app.js";

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
