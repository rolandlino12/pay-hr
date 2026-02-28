/**
 * Payroll Calculation Engine - Togo LOFI 2023
 * 
 * Implements:
 * - CNSS (Employee 4%, Employer 17.5%)
 * - AMU (Employee 5%, Employer 5%)
 * - IRPP Progressive Tax Brackets with:
 *   - 28% flat abatement (capped at 10,000,000 FCFA base)
 *   - Family charge deductions (10,000 FCFA/month per dependent, max 6 children)
 */

// Tax configuration - can be updated for future law changes
export const TAX_CONFIG = {
  cnss: {
    employee: 0.04,
    employer: 0.175,
  },
  amu: {
    employee: 0.05,
    employer: 0.05,
  },
  irpp: {
    minimumTaxableMonthly: 75000,
    abatementRate: 0.28, // 28% flat abatement
    abatementCap: 10000000, // Maximum base for abatement calculation
    familyChargeDeduction: 10000, // 10,000 FCFA per dependent per month
    maxChildren: 6, // Maximum 6 children for deduction
    // Formule mensuelle: IRPP = (R - seuil) × 35% + constante
    // Tranches mensuelles avec seuils et constantes
    monthlyBrackets: [
      { max: 75000, rate: 0, threshold: 0, constant: 0 },
      { max: 250000, rate: 0.03, threshold: 75000, constant: 0 },
      { max: 500000, rate: 0.10, threshold: 250000, constant: 5250 },
      { max: 750000, rate: 0.15, threshold: 500000, constant: 30250 },
      { max: 1000000, rate: 0.20, threshold: 750000, constant: 67750 },
      { max: 1250000, rate: 0.25, threshold: 1000000, constant: 117750 },
      { max: 1666000, rate: 0.30, threshold: 1250000, constant: 180250 },
      { max: Infinity, rate: 0.35, threshold: 1666000, constant: 305050 },
    ],
  },
};

export interface SalaryComponent {
  id: string;
  name: string;
  amount: number;
  isTaxable: boolean; // Subject to IRPP
  includedInCNSS: boolean;
  includedInAMU: boolean;
  isRecurring: boolean;
}

export interface PayrollDeduction {
  id: string;
  type: "avance" | "acompte" | "opposition";
  description: string;
  amount: number;
  beneficiary?: string;
}

export interface EmployeeFamilyInfo {
  isMarried: boolean;
  numberOfChildren: number; // 0-6 (capped at 6 for tax purposes)
}

export interface PayrollInput {
  baseSalary: number;
  components: SalaryComponent[];
  deductions?: PayrollDeduction[]; // Optional deductions for the current month
  familyInfo?: EmployeeFamilyInfo; // Family situation for tax deductions
  workedDays?: number; // Jours travaillés dans le mois (prorata sur 30 jours calendaires)
}

export interface PayrollBreakdown {
  // Earnings
  baseSalary: number;
  totalAllowances: number;
  totalBonuses: number;
  grossEarnings: number;
  
  // Taxable bases
  cnssBase: number;
  amuBase: number;
  
  // Employee deductions (statutory)
  cnssEmployee: number;
  amuEmployee: number;
  
  // IRPP calculation details
  grossTaxableIncome: number; // Before abatement
  abatementAmount: number; // 28% abatement
  netTaxableIncome: number; // After abatement
  monthlyTaxableIncome: number; // Before rounding
  roundedMonthlyTaxableIncome: number; // Arrondi au millier inférieur
  annualTaxableIncome: number;
  annualIRPPBeforeDeductions: number;
  familyChargeDeduction: number; // Monthly family deduction
  annualIRPP: number;
  monthlyIRPP: number;
  totalStatutoryDeductions: number; // CNSS + AMU + IRPP
  
  // Other deductions (avances, acomptes, oppositions)
  avances: number;
  acomptes: number;
  oppositions: number;
  totalOtherDeductions: number;
  deductionDetails: {
    type: string;
    description: string;
    amount: number;
    beneficiary?: string;
  }[];
  
  // Total deductions and net
  totalDeductions: number; // All deductions combined
  netSalary: number;
  netAfterDeductions: number; // Final amount paid to employee
  
  // Employer contributions
  cnssEmployer: number;
  amuEmployer: number;
  totalEmployerContributions: number;
  totalEmployerCost: number;
  
  // Prorata info
  workedDays: number;
  calendarDays: number;
  prorataFactor: number;

  // Details
  componentBreakdown: {
    name: string;
    amount: number;
    isTaxable: boolean;
    includedInCNSS: boolean;
    includedInAMU: boolean;
  }[];
  
  // Family info used
  familyInfo: {
    isMarried: boolean;
    numberOfChildren: number;
    totalDependents: number; // spouse + children (capped)
  };
}

/**
 * Round down to nearest 1000 CFA
 */
function roundDownTo1000(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

/**
 * Round to nearest 10 CFA (for monthly IRPP)
 */
function roundToNearest10(amount: number): number {
  return Math.round(amount / 10) * 10;
}

/**
 * Calculate the 28% abatement amount
 * The abatement is 28% of the income, but capped at 28% of 10,000,000 = 2,800,000
 */
function calculateAbatement(grossTaxableIncome: number): number {
  const cappedBase = Math.min(grossTaxableIncome, TAX_CONFIG.irpp.abatementCap);
  return Math.round(cappedBase * TAX_CONFIG.irpp.abatementRate);
}

/**
 * Calculate IRPP using monthly formula
 * IRPP mensuel = (R - seuil) × taux% + constante
 * Important: Le revenu imposable est arrondi au millier inférieur AVANT le calcul
 */
function calculateMonthlyIRPP(monthlyTaxableIncome: number): number {
  // Arrondir le revenu imposable au millier inférieur (ex: 456 789 → 456 000)
  const roundedIncome = roundDownTo1000(monthlyTaxableIncome);
  
  if (roundedIncome <= TAX_CONFIG.irpp.minimumTaxableMonthly) return 0;
  
  // Trouver la tranche appropriée et appliquer la formule
  for (const bracket of TAX_CONFIG.irpp.monthlyBrackets) {
    if (roundedIncome <= bracket.max) {
      // IRPP = (R - seuil) × taux + constante
      const irpp = (roundedIncome - bracket.threshold) * bracket.rate + bracket.constant;
      // L'IRPP est arrondi à la dizaine de francs (pas au millier)
      return roundToNearest10(Math.max(0, irpp));
    }
  }
  
  // Tranche maximale (> 1 666 000)
  const lastBracket = TAX_CONFIG.irpp.monthlyBrackets[TAX_CONFIG.irpp.monthlyBrackets.length - 1];
  const irpp = (roundedIncome - lastBracket.threshold) * lastBracket.rate + lastBracket.constant;
  return roundToNearest10(Math.max(0, irpp));
}

/**
 * Calculate family charge deductions
 * - Married: 1 dependent (spouse)
 * - Children: up to 6 (capped)
 * - Deduction: 10,000 FCFA per dependent per month
 */
function calculateFamilyChargeDeduction(familyInfo?: EmployeeFamilyInfo): { 
  monthlyDeduction: number; 
  totalDependents: number;
  isMarried: boolean;
  numberOfChildren: number;
} {
  if (!familyInfo) {
    return { 
      monthlyDeduction: 0, 
      totalDependents: 0,
      isMarried: false,
      numberOfChildren: 0
    };
  }
  
  const spouseCount = familyInfo.isMarried ? 1 : 0;
  const childrenCount = Math.min(familyInfo.numberOfChildren, TAX_CONFIG.irpp.maxChildren);
  const totalDependents = spouseCount + childrenCount;
  
  const monthlyDeduction = totalDependents * TAX_CONFIG.irpp.familyChargeDeduction;
  
  return { 
    monthlyDeduction, 
    totalDependents,
    isMarried: familyInfo.isMarried,
    numberOfChildren: childrenCount
  };
}

/**
 * Main payroll calculation function
 */
export function calculatePayroll(input: PayrollInput): PayrollBreakdown {
  const { baseSalary, components, deductions = [], familyInfo, workedDays } = input;
  
  // Prorata calculation: default to 30 days (full month)
  const calendarDays = 30;
  const effectiveWorkedDays = workedDays !== undefined ? Math.min(workedDays, calendarDays) : calendarDays;
  const prorataFactor = effectiveWorkedDays / calendarDays;
  
  // Apply prorata to base salary
  const proratedBaseSalary = Math.round(baseSalary * prorataFactor);
  
  // Calculate component totals (also prorated)
  let totalAllowances = 0;
  let totalBonuses = 0;
  let cnssBase = proratedBaseSalary;
  let amuBase = proratedBaseSalary;
  let taxableBase = proratedBaseSalary;
  
  const componentBreakdown = components.map(comp => {
    const proratedAmount = comp.isRecurring ? Math.round(comp.amount * prorataFactor) : comp.amount;
    
    if (comp.isRecurring) {
      totalAllowances += proratedAmount;
    } else {
      totalBonuses += proratedAmount;
    }
    
    if (comp.includedInCNSS) cnssBase += proratedAmount;
    if (comp.includedInAMU) amuBase += proratedAmount;
    if (comp.isTaxable) taxableBase += proratedAmount;
    
    return {
      name: comp.name,
      amount: proratedAmount,
      isTaxable: comp.isTaxable,
      includedInCNSS: comp.includedInCNSS,
      includedInAMU: comp.includedInAMU,
    };
  });
  
  // Gross earnings
  const grossEarnings = proratedBaseSalary + totalAllowances + totalBonuses;
  
  // Employee social deductions
  const cnssEmployee = Math.round(cnssBase * TAX_CONFIG.cnss.employee);
  const amuEmployee = Math.round(amuBase * TAX_CONFIG.amu.employee);
  
  // Step 1: Gross taxable income (after social deductions)
  const grossTaxableIncome = taxableBase - cnssEmployee - amuEmployee;
  
  // Step 2: Apply 28% abatement
  const abatementAmount = calculateAbatement(grossTaxableIncome);
  
  // Step 3: Net taxable income (after abatement)
  const netTaxableIncome = Math.max(0, grossTaxableIncome - abatementAmount);
  
  // Step 4: Calculate family charge deductions (also prorated)
  const familyDeductionInfo = calculateFamilyChargeDeduction(familyInfo);
  const proratedFamilyDeduction = Math.round(familyDeductionInfo.monthlyDeduction * prorataFactor);
  
  // Step 5: Déduire les charges familiales du revenu imposable (pas de l'IRPP)
  const monthlyTaxableIncomeBeforeFamily = netTaxableIncome;
  const monthlyTaxableIncome = Math.max(0, monthlyTaxableIncomeBeforeFamily - proratedFamilyDeduction);
  
  // Step 6: Arrondir le revenu imposable au millier inférieur pour le calcul IRPP
  const roundedMonthlyTaxableIncome = roundDownTo1000(monthlyTaxableIncome);
  
  // Step 7: IRPP calculation using monthly formula
  let monthlyIRPP = 0;
  
  if (monthlyTaxableIncome > TAX_CONFIG.irpp.minimumTaxableMonthly) {
    monthlyIRPP = calculateMonthlyIRPP(monthlyTaxableIncome);
  }
  
  const annualTaxableIncome = monthlyTaxableIncome * 12;
  const annualIRPP = monthlyIRPP * 12;
  
  // Statutory deductions (social + tax)
  const totalStatutoryDeductions = cnssEmployee + amuEmployee + monthlyIRPP;
  
  // Net salary before other deductions
  const netSalary = grossEarnings - totalStatutoryDeductions;
  
  // Calculate other deductions (avances, acomptes, oppositions)
  let avances = 0;
  let acomptes = 0;
  let oppositions = 0;
  
  const deductionDetails = deductions.map(d => {
    switch (d.type) {
      case "avance":
        avances += d.amount;
        break;
      case "acompte":
        acomptes += d.amount;
        break;
      case "opposition":
        oppositions += d.amount;
        break;
    }
    return {
      type: d.type,
      description: d.description,
      amount: d.amount,
      beneficiary: d.beneficiary,
    };
  });
  
  const totalOtherDeductions = avances + acomptes + oppositions;
  const totalDeductions = totalStatutoryDeductions + totalOtherDeductions;
  const netAfterDeductions = netSalary - totalOtherDeductions;
  
  // Employer contributions
  const cnssEmployer = Math.round(cnssBase * TAX_CONFIG.cnss.employer);
  const amuEmployer = Math.round(amuBase * TAX_CONFIG.amu.employer);
  const totalEmployerContributions = cnssEmployer + amuEmployer;
  const totalEmployerCost = grossEarnings + totalEmployerContributions;
  
  return {
    baseSalary: proratedBaseSalary,
    totalAllowances,
    totalBonuses,
    grossEarnings,
    cnssBase,
    amuBase,
    cnssEmployee,
    amuEmployee,
    grossTaxableIncome,
    abatementAmount,
    netTaxableIncome,
    monthlyTaxableIncome,
    roundedMonthlyTaxableIncome,
    annualTaxableIncome: roundDownTo1000(annualTaxableIncome),
    annualIRPPBeforeDeductions: annualIRPP,
    familyChargeDeduction: proratedFamilyDeduction,
    annualIRPP,
    monthlyIRPP,
    totalStatutoryDeductions,
    avances,
    acomptes,
    oppositions,
    totalOtherDeductions,
    deductionDetails,
    totalDeductions,
    netSalary,
    netAfterDeductions,
    cnssEmployer,
    amuEmployer,
    totalEmployerContributions,
    totalEmployerCost,
    workedDays: effectiveWorkedDays,
    calendarDays,
    prorataFactor,
    componentBreakdown,
    familyInfo: {
      isMarried: familyDeductionInfo.isMarried,
      numberOfChildren: familyDeductionInfo.numberOfChildren,
      totalDependents: familyDeductionInfo.totalDependents,
    },
  };
}

/**
 * Format currency in CFA
 */
export function formatCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
