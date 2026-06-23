import { afterEach, describe, expect, it } from "vitest";
import { prefersHtmlResponse, publicWebUrl } from "./publicWebUrl.js";

describe("publicWebUrl", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("ignores Render PUBLIC_WEB_URL", () => {
    process.env.PUBLIC_WEB_URL = "https://benimogretmenim-web.onrender.com";
    expect(publicWebUrl()).toBe("https://benimogretmenim.com.tr");
  });

  it("uses PUBLIC_WEB_URL when set", () => {
    process.env.PUBLIC_WEB_URL = "https://web.example.com/";
    expect(publicWebUrl()).toBe("https://web.example.com");
  });

  it("falls back to first CORS origin", () => {
    delete process.env.PUBLIC_WEB_URL;
    process.env.CORS_ORIGINS = "https://a.test,https://b.test";
    expect(publicWebUrl()).toBe("https://a.test");
  });
});

describe("prefersHtmlResponse", () => {
  it("redirects typical browser Accept", () => {
    expect(
      prefersHtmlResponse(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
    ).toBe(true);
  });

  it("keeps JSON for API clients", () => {
    expect(prefersHtmlResponse("application/json")).toBe(false);
    expect(prefersHtmlResponse(undefined)).toBe(false);
  });
});
