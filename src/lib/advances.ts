/**
 * Advances & Deductions Management System
 * Implements Togo Labor Law compliance (1/10th rule)
 */

export type AdvanceType = "acompte" | "avance" | "opposition";
export type AdvanceStatus = "pending" | "active" | "paid" | "cancelled";

export interface Advance {
  id: string;
  employeeId: string;
  type: AdvanceType;
  totalAmount: number;
  remainingBalance: number;
  monthlyDeduction: number;
  numberOfMonths: number; // 1 for acompte, variable for avance/opposition
  startMonth: string; // YYYY-MM - first deduction month
  createdAt: string;
  status: AdvanceStatus;
  description?: string;
  reference?: string;
  beneficiary?: string; // For opposition: creditor name
}

export interface AdvancePayment {
  id: string;
  advanceId: string;
  month: string; // YYYY-MM
  amount: number;
  paidAt: string;
}

/**
 * Calculate monthly deduction amount
 */
export function calculateMonthlyDeduction(totalAmount: number, numberOfMonths: number): number {
  if (numberOfMonths <= 0) return 0;
  return Math.ceil(totalAmount / numberOfMonths);
}

/**
 * Check if monthly deduction exceeds 1/3 of base salary (Togo Labor Law)
 */
export function exceedsLegalLimit(monthlyDeduction: number, baseSalary: number): boolean {
  const maxAllowed = baseSalary / 3;
  return monthlyDeduction > maxAllowed;
}

/**
 * Get legal limit message
 */
export function getLegalLimitWarning(monthlyDeduction: number, baseSalary: number): string | null {
  const maxAllowed = baseSalary / 3;
  if (monthlyDeduction > maxAllowed) {
    return `Avertissement: Cette déduction dépasse la limite légale de 1/3 du salaire de base (${formatCFA(maxAllowed)}) selon le Code du Travail du Togo.`;
  }
  return null;
}

/**
 * Check if acompte exceeds 1/3 of base salary
 */
export function exceedsAcompteLimit(amount: number, baseSalary: number): boolean {
  const maxAllowed = baseSalary / 3;
  return amount > maxAllowed;
}

/**
 * Get acompte limit warning
 */
export function getAcompteLimitWarning(amount: number, baseSalary: number): string | null {
  const maxAllowed = baseSalary / 3;
  if (amount > maxAllowed) {
    return `L'acompte ne peut pas dépasser 1/3 du salaire de base (${formatCFA(maxAllowed)}).`;
  }
  return null;
}

/**
 * Calculate next deduction month
 */
export function getNextMonth(currentMonth: string): string {
  const [year, month] = currentMonth.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculate advance status based on remaining balance
 */
export function calculateAdvanceStatus(advance: Advance, currentMonth: string): AdvanceStatus {
  if (advance.status === 'cancelled') return 'cancelled';
  if (advance.remainingBalance <= 0) return 'paid';
  if (advance.startMonth > currentMonth) return 'pending';
  return 'active';
}

/**
 * Get deductions due for a specific month from active advances
 */
export function getMonthlyDeductions(advances: Advance[], month: string): { advanceId: string; amount: number }[] {
  return advances
    .filter(a => {
      if (a.status === 'cancelled' || a.status === 'paid') return false;
      if (a.startMonth > month) return false;
      if (a.remainingBalance <= 0) return false;
      return true;
    })
    .map(a => ({
      advanceId: a.id,
      amount: Math.min(a.monthlyDeduction, a.remainingBalance),
    }));
}

/**
 * Generate advance ID
 */
export function generateAdvanceId(): string {
  return `adv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format CFA (duplicated for standalone use)
 */
function formatCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

/**
 * Get advance type label
 */
export function getAdvanceTypeLabel(type: AdvanceType): string {
  const labels: Record<AdvanceType, string> = {
    acompte: 'Acompte',
    avance: 'Avance sur salaire',
    opposition: 'Opposition sur salaire',
  };
  return labels[type];
}

/**
 * Get status label
 */
export function getAdvanceStatusLabel(status: AdvanceStatus): string {
  const labels: Record<AdvanceStatus, string> = {
    pending: 'En attente',
    active: 'En cours',
    paid: 'Remboursé',
    cancelled: 'Annulé',
  };
  return labels[status];
}

/**
 * Get status color classes
 */
export function getAdvanceStatusColor(status: AdvanceStatus): string {
  const colors: Record<AdvanceStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colors[status];
}
