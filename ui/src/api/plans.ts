import { api } from "./client";

export interface PlanListItem {
  id: string;
  name: string;
  date: string | null;
  source: string;
  relativePath: string;
  updatedAt: string;
}

export interface PlanDetail extends PlanListItem {
  content: string;
}

export const plansApi = {
  list: () => api.get<{ plans: PlanListItem[] }>("/plans"),
  get: (planId: string) => api.get<PlanDetail>(`/plans/${encodeURIComponent(planId)}`),
};
