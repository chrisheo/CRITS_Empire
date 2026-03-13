import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclipai/db";
import { assertBoard } from "./authz.js";

interface PlanRouteOptions {
  planRoots?: string[];
}

interface PlanListItem {
  id: string;
  name: string;
  date: string | null;
  source: string;
  relativePath: string;
  updatedAt: string;
}

const DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[-_].*)?$/;

function parseDateFromName(name: string): string | null {
  const stem = name.replace(/\.md$/i, "");
  const match = DATE_PREFIX_PATTERN.exec(stem);
  return match ? match[1] : null;
}

function buildDefaultPlanRoots() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, "../../");
  return [
    path.resolve(repoRoot, "plans"),
    path.resolve(repoRoot, "doc/plans"),
  ];
}

export function planRoutes(_db: Db, options: PlanRouteOptions = {}) {
  const router = Router();
  const roots = options.planRoots ?? buildDefaultPlanRoots();

  async function readPlanFiles() {
    const items: PlanListItem[] = [];

    for (const rootDir of roots) {
      const source = path.basename(rootDir);
      let entries: Awaited<ReturnType<typeof fs.readdir>>;
      try {
        entries = await fs.readdir(rootDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
          continue;
        }

        const fullPath = path.resolve(rootDir, entry.name);
        const stats = await fs.stat(fullPath);
        items.push({
          id: `${source}:${entry.name}`,
          name: entry.name,
          date: parseDateFromName(entry.name),
          source,
          relativePath: `${source}/${entry.name}`,
          updatedAt: stats.mtime.toISOString(),
        });
      }
    }

    items.sort((a, b) => {
      const aDate = a.date ?? "";
      const bDate = b.date ?? "";
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return b.name.localeCompare(a.name);
    });

    return items;
  }

  router.get("/plans", async (req, res) => {
    assertBoard(req);
    const plans = await readPlanFiles();
    res.json({ plans });
  });

  router.get("/plans/:planId", async (req, res) => {
    assertBoard(req);
    const planId = req.params.planId as string;
    const plans = await readPlanFiles();
    const selected = plans.find((plan) => plan.id === planId);

    if (!selected) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const [source] = selected.id.split(":");
    const rootDir = roots.find((root) => path.basename(root) === source);
    if (!rootDir) {
      res.status(404).json({ error: "Plan source not found" });
      return;
    }

    const fullPath = path.resolve(rootDir, selected.name);
    const content = await fs.readFile(fullPath, "utf-8");

    res.json({
      ...selected,
      content,
    });
  });

  return router;
}
