import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const publicRoot = path.join(root, "public");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
]);

const resolvePublicPath = (pathname) => {
  if (pathname === "/" || pathname === "/index.html") return path.join(root, "index.html");
  if (pathname === "/app.js" || pathname === "/styles.css") {
    return path.join(root, pathname.slice(1));
  }
  if (["/src/", "/trust/", "/config/"].some((prefix) => pathname.startsWith(prefix))) {
    return path.resolve(root, `.${pathname}`);
  }
  if (pathname.startsWith("/.well-known/") || /^\/og(?:-v\d+)?\.png$/.test(pathname)) {
    return path.resolve(publicRoot, `.${pathname}`);
  }
  return null;
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  let pathname = requestUrl.pathname;

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400, {
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    response.end("Bad request");
    return;
  }

  const filePath = resolvePublicPath(pathname);

  if (!filePath || !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404).end("Not found");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Independent Illinois Offense Code Reference: http://${host}:${port}`);
});
