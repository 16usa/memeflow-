import { Router, type IRouter, type Request, type Response } from "express";
import http from "node:http";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

// Proxy all unhandled /api/* requests to the MEMEFLOW app server.
// The Replit path-router sends every /api/* browser request here; MEMEFLOW
// owns the real implementation on port 25904.
//
// NOTE: Express's json() + urlencoded() middleware already consumed the raw
// body stream before this handler runs. We re-serialize req.body to JSON and
// set the correct Content-Length so MEMEFLOW receives a valid request.
const MEMEFLOW_PORT = parseInt(process.env.MEMEFLOW_PORT || "25904", 10);

router.use((req: Request, res: Response) => {
  const targetPath = req.originalUrl; // preserve full /api/... prefix

  // Re-serialize the already-parsed body (empty for GET/HEAD/DELETE)
  const hasBody =
    req.body !== undefined &&
    req.body !== null &&
    Object.keys(req.body).length > 0;
  const bodyBuf = hasBody
    ? Buffer.from(JSON.stringify(req.body), "utf8")
    : Buffer.alloc(0);

  const proxyHeaders: Record<string, string | string[]> = {};
  // Forward safe headers — skip host, content-length (we'll set our own)
  for (const [k, v] of Object.entries(req.headers)) {
    const kl = k.toLowerCase();
    if (kl === "host" || kl === "content-length") continue;
    if (v !== undefined) proxyHeaders[k] = v as string | string[];
  }
  proxyHeaders["host"] = `127.0.0.1:${MEMEFLOW_PORT}`;
  if (hasBody) {
    proxyHeaders["content-type"] = "application/json";
    proxyHeaders["content-length"] = String(bodyBuf.length);
  }

  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: MEMEFLOW_PORT,
      path: targetPath,
      method: req.method,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      // Forward status + all response headers (including Set-Cookie)
      const outHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (v !== undefined) outHeaders[k] = v as string | string[];
      }
      res.writeHead(proxyRes.statusCode ?? 502, outHeaders);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res
        .status(502)
        .json({ error: "MEMEFLOW_PROXY_ERROR", detail: err.message });
    }
  });

  if (hasBody) proxyReq.write(bodyBuf);
  proxyReq.end();
});

export default router;
