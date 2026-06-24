import type { MiddlewareHandler } from "hono";
import { publicWebUrl } from "../lib/publicWebUrl.js";

const MISPLACED_WEB_HOSTS = new Set(["www.benimogretmenim.com.tr"]);

/**
 * www custom domain yanlışlıkla API servisinde kaldığında tarayıcıyı web köküne yönlendirir.
 * Kalıcı çözüm: render.yaml domains — www yalnızca benimogretmenim-web servisinde.
 */
export const redirectMisplacedWebHost: MiddlewareHandler = async (c, next) => {
  const host = c.req.header("host")?.split(":")[0] ?? "";
  if (!MISPLACED_WEB_HOSTS.has(host)) {
    await next();
    return;
  }
  const target = new URL(c.req.path, publicWebUrl());
  target.search = new URL(c.req.url).search;
  return c.redirect(target.toString(), 308);
};
