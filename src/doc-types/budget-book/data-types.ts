/**
 * BudgetBookData — the structured data model for municipal budget books.
 *
 * Extracted from src/core/providers.ts so it lives with the budget-book
 * document type definition. Core providers.ts re-exports these types
 * for backward compatibility.
 */

import { z } from "zod";

// ─── Row / Detail Types ────────────────────────────────────────────────────

export interface RevenueDetailRow {
  fundCode: string;
  fundName: string;
  accountCode: string;
  accountName: string;
  priorActual: number;
  currentBudget: number;
  proposedBudget: number;
}

export interface ExpenditureByDepartmentRow {
  departmentCode: string;
  departmentName: string;
  priorActual: number;
  currentBudget: number;
  proposedBudget: number;
}

export interface PersonnelDetailRow {
  department: string;
  positionTitle: string;
  fte: number;
  salary: number;
  benefits: number;
  totalCompensation: number;
}

export interface CapitalProjectDetail {
  projectName: string;
  description: string;
  department: string;
  totalCost: number;
  fundingSource: string;
  yearOneAmount: number;
  status: string;
}

export interface ProjectionYear {
  fiscalYear: number;
  revenue: number;
  expenditure: number;
  fundBalance: number;
  notes: string;
}

export interface CommunityProfile {
  name: string;
  state: string;
  population: number;
  squareMiles: number;
  formOfGovernment: string;
  established: string;
}

// ─── BudgetBookData ────────────────────────────────────────────────────────

export interface BudgetBookData {
  fiscalYear: number;
  communityProfile: CommunityProfile;
  revenueDetail: RevenueDetailRow[];
  expenditureByDepartment: ExpenditureByDepartmentRow[];
  personnelDetail: PersonnelDetailRow[];
  capitalProjects: CapitalProjectDetail[];
  multiYearProjections: ProjectionYear[];
  totalRevenue: number;
  totalExpenditure: number;
  totalPersonnelCost: number;
  totalCapitalCost: number;
  executiveSummary?: string;
  additionalContext?: Record<string, unknown>;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const revenueDetailRowSchema = z.object({
  fundCode: z.string(),
  fundName: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  priorActual: z.number(),
  currentBudget: z.number(),
  proposedBudget: z.number(),
});

export const expenditureByDepartmentRowSchema = z.object({
  departmentCode: z.string(),
  departmentName: z.string(),
  priorActual: z.number(),
  currentBudget: z.number(),
  proposedBudget: z.number(),
});

export const personnelDetailRowSchema = z.object({
  department: z.string(),
  positionTitle: z.string(),
  fte: z.number(),
  salary: z.number(),
  benefits: z.number(),
  totalCompensation: z.number(),
});

export const capitalProjectDetailSchema = z.object({
  projectName: z.string(),
  description: z.string(),
  department: z.string(),
  totalCost: z.number(),
  fundingSource: z.string(),
  yearOneAmount: z.number(),
  status: z.string(),
});

export const projectionYearSchema = z.object({
  fiscalYear: z.number(),
  revenue: z.number(),
  expenditure: z.number(),
  fundBalance: z.number(),
  notes: z.string(),
});

export const communityProfileSchema = z.object({
  name: z.string(),
  state: z.string(),
  population: z.number(),
  squareMiles: z.number(),
  formOfGovernment: z.string(),
  established: z.string(),
});

export const budgetBookDataSchema = z.object({
  fiscalYear: z.number(),
  communityProfile: communityProfileSchema,
  revenueDetail: z.array(revenueDetailRowSchema),
  expenditureByDepartment: z.array(expenditureByDepartmentRowSchema),
  personnelDetail: z.array(personnelDetailRowSchema),
  capitalProjects: z.array(capitalProjectDetailSchema),
  multiYearProjections: z.array(projectionYearSchema),
  totalRevenue: z.number(),
  totalExpenditure: z.number(),
  totalPersonnelCost: z.number(),
  totalCapitalCost: z.number(),
  executiveSummary: z.string().optional(),
  additionalContext: z.record(z.unknown()).optional(),
});
