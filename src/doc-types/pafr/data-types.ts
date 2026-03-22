/**
 * PafrData — the structured data model for Popular Annual Financial Reports.
 *
 * PAFRs are citizen-facing summaries of a municipality's finances,
 * simpler than a full budget book with a focus on accessibility and readability.
 */

import { z } from "zod";

// ─── Row / Detail Types ────────────────────────────────────────────────────

export interface RevenueBySource {
  source: string;
  amount: number;
  pctOfTotal: number;
}

export interface ExpenditureByFunction {
  function: string;
  amount: number;
  pctOfTotal: number;
}

export interface KeyMetric {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
}

export interface DemographicHighlight {
  metric: string;
  value: string;
  source: string;
}

export interface FundBalance {
  beginning: number;
  ending: number;
  change: number;
}

export interface CommunityProfile {
  name: string;
  state: string;
  population: number;
  squareMiles: number;
  formOfGovernment: string;
}

// ─── PafrData ──────────────────────────────────────────────────────────────

export interface PafrData {
  fiscalYear: number;
  communityProfile: CommunityProfile;
  totalRevenue: number;
  totalExpenditure: number;
  revenueBySource: RevenueBySource[];
  expenditureByFunction: ExpenditureByFunction[];
  keyMetrics: KeyMetric[];
  demographicHighlights: DemographicHighlight[];
  fundBalance: FundBalance;
  leadershipMessage?: string;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const revenueBySourceSchema = z.object({
  source: z.string(),
  amount: z.number(),
  pctOfTotal: z.number(),
});

export const expenditureByFunctionSchema = z.object({
  function: z.string(),
  amount: z.number(),
  pctOfTotal: z.number(),
});

export const keyMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.enum(["up", "down", "flat"]),
});

export const demographicHighlightSchema = z.object({
  metric: z.string(),
  value: z.string(),
  source: z.string(),
});

export const fundBalanceSchema = z.object({
  beginning: z.number(),
  ending: z.number(),
  change: z.number(),
});

export const communityProfileSchema = z.object({
  name: z.string(),
  state: z.string(),
  population: z.number(),
  squareMiles: z.number(),
  formOfGovernment: z.string(),
});

export const pafrDataSchema = z.object({
  fiscalYear: z.number(),
  communityProfile: communityProfileSchema,
  totalRevenue: z.number(),
  totalExpenditure: z.number(),
  revenueBySource: z.array(revenueBySourceSchema),
  expenditureByFunction: z.array(expenditureByFunctionSchema),
  keyMetrics: z.array(keyMetricSchema),
  demographicHighlights: z.array(demographicHighlightSchema),
  fundBalance: fundBalanceSchema,
  leadershipMessage: z.string().optional(),
});
