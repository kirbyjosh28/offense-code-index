const indexHtml = "__INDEX_HTML__";

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self'",
    "style-src-attr 'none'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    "require-trusted-types-for 'script'",
  ].join("; "),
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Origin-Agent-Cluster": "?1",
};

const withSecurityHeaders = (response, cacheControl = "no-cache") => {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const worker = {
  async fetch(request, env) {
    if (!["GET", "HEAD"].includes(request.method)) {
      return withSecurityHeaders(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        })
      );
    }

    const assetUrl = new URL(request.url);
    if (assetUrl.pathname === "/" || assetUrl.pathname === "/index.html") {
      return withSecurityHeaders(
        new Response(request.method === "HEAD" ? null : indexHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
    }
    const assetRequest = new Request(assetUrl, request);
    const cacheControl =
      assetUrl.pathname === "/version.json" || assetUrl.pathname.startsWith("/config/")
        ? "no-store, max-age=0"
        : "no-cache";
    return withSecurityHeaders(await env.ASSETS.fetch(assetRequest), cacheControl);
  },
};

export default worker;
