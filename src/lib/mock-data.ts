import { SalaryComponent, PayrollDeduction } from "./payroll-engine";

export type EmployeeStatus = "active" | "suspended" | "left" | "on_leave";

export type UserRole = "admin" | "hr_manager" | "accountant" | "employee";

export interface Department {
  id: string;
  name: string;
  managerId?: string;
  employeeCount: number;
  totalPayrollCost: number;
}

// Types of deductions that reduce net salary
export type DeductionType = "avance" | "acompte" | "opposition";

export interface SalaryDeduction {
  id: string;
  type: DeductionType;
  description: string;
  amount: number;
  month: string; // YYYY-MM - the month this applies to
  beneficiary?: string; // For opposition: creditor name
  reference?: string; // Reference number (court order, etc.)
}

export type MaritalStatus = "single" | "married" | "divorced" | "widowed";

export interface Employee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  hireDate: string;
  endDate?: string; // Date de départ (fin de contrat)
  status: EmployeeStatus;
  departmentId: string;
  position: string;
  baseSalary: number;
  salaryComponents: SalaryComponent[];
  deductions?: SalaryDeduction[]; // Avances, acomptes, oppositions
  // Family situation for IRPP deductions
  maritalStatus?: MaritalStatus;
  numberOfChildren?: number; // 0-6 for tax deductions (max 6 per LOFI 2023)
  cnssNumber?: string;
  amuNumber?: string;
  nif?: string; // Numéro d'Identification Fiscale
  bankName?: string;
  bankAccountNumber?: string;
  address?: string;
  emergencyContact?: string;
  profilePicture?: string; // Base64 encoded image
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  grossEarnings: number;
  cnssEmployee: number;
  amuEmployee: number;
  irpp: number;
  familyChargeDeduction?: number; // Déduction charges familiales appliquée
  netSalary: number;
  cnssEmployer: number;
  amuEmployer: number;
  totalCost: number;
  // Two-step workflow: HR validates, then Admin approves
  isValidated: boolean;
  validatedAt?: string;
  validatedBy?: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  // Modified values (when admin corrects a validated payroll)
  modifiedBaseSalary?: number;
  modifiedComponents?: SalaryComponent[];
  modifiedDeductions?: PayrollDeduction[];
}

// Mock departments
export const mockDepartments: Department[] = [
  { id: "dept-1", name: "Direction Générale", employeeCount: 3, totalPayrollCost: 4500000 },
  { id: "dept-2", name: "Ressources Humaines", employeeCount: 5, totalPayrollCost: 2800000 },
  { id: "dept-3", name: "Comptabilité & Finance", employeeCount: 4, totalPayrollCost: 3200000 },
  { id: "dept-4", name: "Commercial", employeeCount: 8, totalPayrollCost: 4800000 },
  { id: "dept-5", name: "Production", employeeCount: 15, totalPayrollCost: 5500000 },
  { id: "dept-6", name: "Logistique", employeeCount: 6, totalPayrollCost: 2200000 },
];

// Common salary components
const createComponents = (type: 'executive' | 'manager' | 'standard'): SalaryComponent[] => {
  const base: SalaryComponent[] = [
    {
      id: "comp-transport",
      name: "Indemnité de transport",
      amount: type === 'executive' ? 75000 : type === 'manager' ? 50000 : 30000,
      isTaxable: false,
      includedInCNSS: false,
      includedInAMU: false,
      isRecurring: true,
    },
    {
      id: "comp-logement",
      name: "Indemnité de logement",
      amount: type === 'executive' ? 150000 : type === 'manager' ? 100000 : 50000,
      isTaxable: true,
      includedInCNSS: true,
      includedInAMU: true,
      isRecurring: true,
    },
  ];

  if (type === 'executive') {
    base.push({
      id: "comp-representation",
      name: "Indemnité de représentation",
      amount: 100000,
      isTaxable: true,
      includedInCNSS: false,
      includedInAMU: false,
      isRecurring: true,
    });
  }

  return base;
};

// Mock employees
export const mockEmployees: Employee[] = [
  {
    id: "emp-1",
    matricule: "EMP001",
    firstName: "Kofi",
    lastName: "MENSAH",
    email: "k.mensah@entreprise.tg",
    phone: "+228 90 12 34 56",
    dateOfBirth: "1975-03-15",
    hireDate: "2010-01-15",
    status: "active",
    departmentId: "dept-1",
    position: "Directeur Général",
    baseSalary: 1500000,
    salaryComponents: createComponents('executive'),
    cnssNumber: "CNSS-2010-001234",
    bankName: "Ecobank",
    bankAccountNumber: "TG53 0001 2345 6789",
  },
  {
    id: "emp-2",
    matricule: "EMP002",
    firstName: "Ama",
    lastName: "KOUASSI",
    email: "a.kouassi@entreprise.tg",
    phone: "+228 91 23 45 67",
    dateOfBirth: "1982-07-22",
    hireDate: "2015-03-01",
    status: "active",
    departmentId: "dept-2",
    position: "Responsable RH",
    baseSalary: 800000,
    salaryComponents: createComponents('manager'),
    cnssNumber: "CNSS-2015-002345",
    bankName: "UTB",
    bankAccountNumber: "TG53 0002 3456 7890",
  },
  {
    id: "emp-3",
    matricule: "EMP003",
    firstName: "Kodjo",
    lastName: "AMEGAVI",
    email: "k.amegavi@entreprise.tg",
    phone: "+228 92 34 56 78",
    dateOfBirth: "1988-11-08",
    hireDate: "2018-06-15",
    status: "active",
    departmentId: "dept-3",
    position: "Comptable Principal",
    baseSalary: 650000,
    salaryComponents: createComponents('manager'),
    cnssNumber: "CNSS-2018-003456",
    bankName: "BTCI",
    bankAccountNumber: "TG53 0003 4567 8901",
  },
  {
    id: "emp-4",
    matricule: "EMP004",
    firstName: "Akossiwa",
    lastName: "DOGBEVI",
    email: "a.dogbevi@entreprise.tg",
    phone: "+228 93 45 67 89",
    dateOfBirth: "1990-04-25",
    hireDate: "2019-09-01",
    status: "active",
    departmentId: "dept-4",
    position: "Commercial Senior",
    baseSalary: 450000,
    salaryComponents: createComponents('standard'),
    cnssNumber: "CNSS-2019-004567",
    bankName: "Orabank",
    bankAccountNumber: "TG53 0004 5678 9012",
  },
  {
    id: "emp-5",
    matricule: "EMP005",
    firstName: "Yao",
    lastName: "AGBEKO",
    email: "y.agbeko@entreprise.tg",
    phone: "+228 94 56 78 90",
    dateOfBirth: "1985-09-12",
    hireDate: "2016-02-01",
    status: "suspended",
    departmentId: "dept-5",
    position: "Chef d'équipe Production",
    baseSalary: 380000,
    salaryComponents: createComponents('standard'),
    cnssNumber: "CNSS-2016-005678",
    bankName: "Ecobank",
    bankAccountNumber: "TG53 0005 6789 0123",
  },
  {
    id: "emp-6",
    matricule: "EMP006",
    firstName: "Ablavi",
    lastName: "SANTOS",
    email: "a.santos@entreprise.tg",
    phone: "+228 95 67 89 01",
    dateOfBirth: "1992-12-03",
    hireDate: "2020-01-15",
    status: "active",
    departmentId: "dept-2",
    position: "Assistante RH",
    baseSalary: 280000,
    salaryComponents: createComponents('standard'),
    cnssNumber: "CNSS-2020-006789",
    bankName: "BIA",
    bankAccountNumber: "TG53 0006 7890 1234",
  },
  {
    id: "emp-7",
    matricule: "EMP007",
    firstName: "Komla",
    lastName: "DZIFA",
    email: "k.dzifa@entreprise.tg",
    phone: "+228 96 78 90 12",
    dateOfBirth: "1978-06-18",
    hireDate: "2012-04-01",
    status: "left",
    departmentId: "dept-6",
    position: "Responsable Logistique",
    baseSalary: 520000,
    salaryComponents: createComponents('manager'),
    cnssNumber: "CNSS-2012-007890",
    bankName: "Ecobank",
    bankAccountNumber: "TG53 0007 8901 2345",
  },
  {
    id: "emp-8",
    matricule: "EMP008",
    firstName: "Edem",
    lastName: "KOUDAWO",
    email: "e.koudawo@entreprise.tg",
    phone: "+228 97 89 01 23",
    dateOfBirth: "1995-02-28",
    hireDate: "2022-07-01",
    status: "active",
    departmentId: "dept-4",
    position: "Commercial Junior",
    baseSalary: 250000,
    salaryComponents: createComponents('standard'),
    cnssNumber: "CNSS-2022-008901",
    bankName: "UTB",
    bankAccountNumber: "TG53 0008 9012 3456",
  },
];

// Mock payroll records (December 2024)
export const mockPayrollRecords: PayrollRecord[] = mockEmployees
  .filter(e => e.status === 'active')
  .map(emp => {
    const grossBase = emp.baseSalary + emp.salaryComponents.reduce((sum, c) => sum + c.amount, 0);
    const cnssEmp = Math.round(grossBase * 0.04);
    const amuEmp = Math.round(grossBase * 0.05);
    const taxable = grossBase - cnssEmp - amuEmp;
    const annualTax = taxable * 12;
    let irpp = 0;
    if (taxable > 75000) {
      // Simplified calculation
      if (annualTax > 20000000) irpp = Math.floor(((annualTax - 20000000) * 0.35 + 5550000) / 12000) * 1000;
      else if (annualTax > 15000000) irpp = Math.floor(((annualTax - 15000000) * 0.30 + 4050000) / 12000) * 1000;
      else if (annualTax > 12000000) irpp = Math.floor(((annualTax - 12000000) * 0.25 + 3300000) / 12000) * 1000;
      else if (annualTax > 9000000) irpp = Math.floor(((annualTax - 9000000) * 0.20 + 2700000) / 12000) * 1000;
      else if (annualTax > 6000000) irpp = Math.floor(((annualTax - 6000000) * 0.15 + 2250000) / 12000) * 1000;
      else if (annualTax > 3000000) irpp = Math.floor(((annualTax - 3000000) * 0.10 + 1950000) / 12000) * 1000;
      else if (annualTax > 900000) irpp = Math.floor(((annualTax - 900000) * 0.03) / 12000) * 1000;
    }
    
    return {
      id: `pay-${emp.id}-2024-12`,
      employeeId: emp.id,
      month: "2024-12",
      grossEarnings: grossBase,
      cnssEmployee: cnssEmp,
      amuEmployee: amuEmp,
      irpp,
      netSalary: grossBase - cnssEmp - amuEmp - irpp,
      cnssEmployer: Math.round(grossBase * 0.175),
      amuEmployer: Math.round(grossBase * 0.05),
      totalCost: grossBase + Math.round(grossBase * 0.225),
      isValidated: true,
      validatedAt: "2024-12-25T10:00:00Z",
      validatedBy: "emp-2",
      isApproved: true,
      approvedAt: "2024-12-26T09:00:00Z",
      approvedBy: "emp-1",
    };
  });

// Current user (for demo - Admin role to access all features including Accounting)
export const currentUser = {
  id: "emp-2",
  name: "Ama KOUASSI",
  role: "admin" as UserRole,
  email: "a.kouassi@entreprise.tg",
};

// Summary statistics
export function getPayrollSummary() {
  const activeEmployees = mockEmployees.filter(e => e.status === 'active');
  const totalGross = mockPayrollRecords.reduce((sum, r) => sum + r.grossEarnings, 0);
  const totalNet = mockPayrollRecords.reduce((sum, r) => sum + r.netSalary, 0);
  const totalCNSS = mockPayrollRecords.reduce((sum, r) => sum + r.cnssEmployee + r.cnssEmployer, 0);
  const totalAMU = mockPayrollRecords.reduce((sum, r) => sum + r.amuEmployee + r.amuEmployer, 0);
  const totalIRPP = mockPayrollRecords.reduce((sum, r) => sum + r.irpp, 0);
  const totalCost = mockPayrollRecords.reduce((sum, r) => sum + r.totalCost, 0);

  return {
    employeeCount: {
      total: mockEmployees.length,
      active: activeEmployees.length,
      suspended: mockEmployees.filter(e => e.status === 'suspended').length,
      left: mockEmployees.filter(e => e.status === 'left').length,
    },
    currentMonth: {
      totalGross,
      totalNet,
      totalCNSS,
      totalAMU,
      totalIRPP,
      totalCost,
    },
    departmentCount: mockDepartments.length,
  };
}
