import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { planRoutes } from "../routes/plans.js";

let tempRoot: string;

function createApp(planRoots: string[]) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      source: "session",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", planRoutes({} as any, { planRoots }));
  app.use(errorHandler);
  return app;
}

describe("plan routes", () => {
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-plans-"));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("lists markdown files and returns selected plan content", async () => {
    const plansDir = path.join(tempRoot, "plans");
    const docPlansDir = path.join(tempRoot, "doc", "plans");
    await fs.mkdir(plansDir, { recursive: true });
    await fs.mkdir(docPlansDir, { recursive: true });
    await fs.writeFile(path.join(plansDir, "2026-03-13-crit-base-rules.md"), "# Base Rules\n");
    await fs.writeFile(path.join(docPlansDir, "agent-authentication.md"), "# Agent Auth\n");

    const app = createApp([plansDir, docPlansDir]);

    const listRes = await request(app).get("/api/plans");
    expect(listRes.status).toBe(200);
    expect(listRes.body.plans).toHaveLength(2);
    expect(listRes.body.plans[0].name).toBe("2026-03-13-crit-base-rules.md");

    const selectedId = listRes.body.plans[0].id as string;
    const detailRes = await request(app).get(`/api/plans/${encodeURIComponent(selectedId)}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.content).toContain("Base Rules");
  });
});
