// Tiny static server for the render: the reel scene at "/" and the built site at "/site/".
// It answers HTTP range requests, which Chrome needs to seek inside the mp4 background video.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

export function startServer(port = 4599) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/site") {
      res.writeHead(301, { Location: "/site/" });
      return res.end();
    }
    let file;
    if (url.startsWith("/site/")) {
      const rel = url.slice("/site/".length);
      file = path.join(here, ".site", rel === "" || rel.endsWith("/") ? rel + "index.html" : rel);
    } else {
      file = path.join(here, url === "/" ? "scene.html" : url);
    }
    if (!file.startsWith(here)) {
      res.writeHead(403);
      return res.end();
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        return res.end("not found");
      }
      const type = MIME[path.extname(file)] || "application/octet-stream";
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : stat.size - 1;
        res.writeHead(206, {
          "Content-Type": type,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": end - start + 1,
        });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

// `node serve.mjs` runs it on its own (handy for looking at the scene in a browser)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startServer(Number(process.env.PORT) || 4599);
  console.log("http://127.0.0.1:" + (process.env.PORT || 4599) + "/");
}
