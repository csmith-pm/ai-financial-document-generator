import type { BudgetBookData } from "../../src/core/providers.js";

/**
 * Complete sample BudgetBookData for testing.
 * All fields populated with realistic municipal budget data.
 */
export const sampleBudgetData: BudgetBookData = {
  fiscalYear: 2026,
  communityProfile: {
    name: "Maplewood Township",
    state: "New Jersey",
    population: 24568,
    squareMiles: 3.9,
    formOfGovernment: "Township Committee",
    established: "1922",
  },
  revenueDetail: [
    {
      fundCode: "100",
      fundName: "General Fund",
      accountCode: "3100",
      accountName: "Property Taxes",
      priorActual: 48_500_000,
      currentBudget: 50_200_000,
      proposedBudget: 52_100_000,
    },
    {
      fundCode: "100",
      fundName: "General Fund",
      accountCode: "3200",
      accountName: "State Aid",
      priorActual: 5_200_000,
      currentBudget: 5_350_000,
      proposedBudget: 5_500_000,
    },
    {
      fundCode: "100",
      fundName: "General Fund",
      accountCode: "3300",
      accountName: "Fees and Licenses",
      priorActual: 1_800_000,
      currentBudget: 1_900_000,
      proposedBudget: 2_000_000,
    },
  ],
  expenditureByDepartment: [
    {
      departmentCode: "PD",
      departmentName: "Police",
      priorActual: 12_500_000,
      currentBudget: 13_000_000,
      proposedBudget: 13_500_000,
    },
    {
      departmentCode: "FD",
      departmentName: "Fire",
      priorActual: 8_200_000,
      currentBudget: 8_500_000,
      proposedBudget: 8_900_000,
    },
    {
      departmentCode: "PW",
      departmentName: "Public Works",
      priorActual: 6_100_000,
      currentBudget: 6_400_000,
      proposedBudget: 6_700_000,
    },
  ],
  personnelDetail: [
    {
      department: "Police",
      positionTitle: "Police Officer",
      fte: 45,
      salary: 85_000,
      benefits: 38_000,
      totalCompensation: 123_000,
    },
    {
      department: "Fire",
      positionTitle: "Firefighter",
      fte: 32,
      salary: 78_000,
      benefits: 35_000,
      totalCompensation: 113_000,
    },
  ],
  capitalProjects: [
    {
      projectName: "Main Street Reconstruction",
      description: "Complete reconstruction of Main Street from Elm to Oak",
      department: "Public Works",
      totalCost: 4_500_000,
      fundingSource: "Capital Improvement Fund",
      yearOneAmount: 2_000_000,
      status: "approved",
    },
  ],
  multiYearProjections: [
    { fiscalYear: 2026, revenue: 59_600_000, expenditure: 57_450_000, fundBalance: 8_200_000, notes: "Proposed budget" },
    { fiscalYear: 2027, revenue: 61_300_000, expenditure: 59_100_000, fundBalance: 8_400_000, notes: "Projected" },
    { fiscalYear: 2028, revenue: 63_100_000, expenditure: 60_800_000, fundBalance: 8_700_000, notes: "Projected" },
    { fiscalYear: 2029, revenue: 64_900_000, expenditure: 62_600_000, fundBalance: 9_000_000, notes: "Projected" },
    { fiscalYear: 2030, revenue: 66_800_000, expenditure: 64_500_000, fundBalance: 9_300_000, notes: "Projected" },
  ],
  totalRevenue: 59_600_000,
  totalExpenditure: 57_450_000,
  totalPersonnelCost: 29_100_000,
  totalCapitalCost: 4_500_000,
  executiveSummary:
    "The FY2026 budget reflects Maplewood Township's commitment to maintaining high-quality services while exercising fiscal responsibility.",
};

/**
 * Minimal BudgetBookData with many fields empty — for testing gap detection.
 */
export const sparseBudgetData: BudgetBookData = {
  fiscalYear: 2026,
  communityProfile: {
    name: "",
    state: "",
    population: 0,
    squareMiles: 0,
    formOfGovernment: "",
    established: "",
  },
  revenueDetail: [],
  expenditureByDepartment: [],
  personnelDetail: [],
  capitalProjects: [],
  multiYearProjections: [],
  totalRevenue: 0,
  totalExpenditure: 0,
  totalPersonnelCost: 0,
  totalCapitalCost: 0,
};
