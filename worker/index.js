const indexHtml = "__INDEX_HTML__";

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; "),
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const withSecurityHeaders = (response) => {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
  headers.set("Cache-Control", "no-cache");
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
    return withSecurityHeaders(await env.ASSETS.fetch(assetRequest));
  },
};

export default worker;
