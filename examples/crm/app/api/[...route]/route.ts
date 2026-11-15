import { Hono } from "hono";
import { handle } from "hono/vercel";
import { api, ensureDbInitialized } from "@/lib/cube.api";

const server = new Hono().basePath("/api");

let ready = false;
server.use("*", async (_c, next) => {
  if (!ready) {
    await ensureDbInitialized();
    ready = true;
  }
  await next();
});

server.route("/", api);

export const GET = handle(server);
export const POST = handle(server);
export const PUT = handle(server);
export const PATCH = handle(server);
export const DELETE = handle(server);
