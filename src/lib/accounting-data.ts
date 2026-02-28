// Plan comptable SYSCOHADA simplifié pour la paie
export interface Account {
  id: string;
  code: string;
  label: string;
  type: 'asset' | 'liability' | 'expense' | 'revenue' | 'equity';
  category: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
  status: 'draft' | 'validated';
  createdAt: string;
  validatedAt?: string;
}

export interface JournalLine {
  accountCode: string;
  accountLabel: string;
  debit: number;
  credit: number;
  label?: string;
}

export interface LedgerEntry {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface BalanceEntry {
  accountCode: string;
  accountLabel: string;
  debitMovement: number;
  creditMovement: number;
  debitBalance: number;
  creditBalance: number;
}

// Plan comptable SYSCOHADA pour la gestion de la paie
export const syscohadaAccounts: Account[] = [
  // Classe 4 - Tiers
  { id: '421', code: '421', label: 'Personnel - Rémunérations dues', type: 'liability', category: 'Tiers' },
  { id: '422', code: '422', label: 'Personnel - Avances et acomptes', type: 'asset', category: 'Tiers' },
  { id: '431', code: '431', label: 'Sécurité sociale (CNSS)', type: 'liability', category: 'Tiers' },
  { id: '432', code: '432', label: 'Assurance maladie (AMU)', type: 'liability', category: 'Tiers' },
  { id: '433', code: '433', label: 'Organismes sociaux - Cotisations diverses', type: 'liability', category: 'Tiers' },
  { id: '442', code: '442', label: 'État - Impôts et taxes (IRPP)', type: 'liability', category: 'Tiers' },
  { id: '512', code: '512', label: 'Banque', type: 'asset', category: 'Trésorerie' },
  { id: '531', code: '531', label: 'Caisse', type: 'asset', category: 'Trésorerie' },
  
  // Classe 6 - Charges
  { id: '641', code: '641', label: 'Rémunérations du personnel national', type: 'expense', category: 'Charges de personnel' },
  { id: '6411', code: '6411', label: 'Salaires et appointements', type: 'expense', category: 'Charges de personnel' },
  { id: '6412', code: '6412', label: 'Primes et gratifications', type: 'expense', category: 'Charges de personnel' },
  { id: '6413', code: '6413', label: 'Indemnités et avantages divers', type: 'expense', category: 'Charges de personnel' },
  { id: '645', code: '645', label: 'Charges de sécurité sociale', type: 'expense', category: 'Charges de personnel' },
  { id: '6451', code: '6451', label: 'Cotisations CNSS employeur', type: 'expense', category: 'Charges de personnel' },
  { id: '6452', code: '6452', label: 'Cotisations AMU employeur', type: 'expense', category: 'Charges de personnel' },
  { id: '6453', code: '6453', label: 'Cotisations aux autres organismes sociaux', type: 'expense', category: 'Charges de personnel' },
];

// Catégories de comptes pour le filtre
export const accountCategories = [
  'Tous',
  'Tiers',
  'Trésorerie',
  'Charges de personnel',
];

export function generatePayrollJournalEntries(
  month: string,
  payrollData: {
    totalGross: number;
    totalNet: number;
    cnssEmployee: number;
    cnssEmployer: number;
    amuEmployee: number;
    amuEmployer: number;
    irpp: number;
    totalAllowances: number;
  }
): JournalEntry {
  const now = new Date().toISOString();
  const monthDate = new Date(month + '-01');
  const monthLabel = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  
  const baseSalaries = payrollData.totalGross - payrollData.totalAllowances;
  
  const lines: JournalLine[] = [
    // Charges de personnel (débit)
    {
      accountCode: '6411',
      accountLabel: 'Salaires et appointements',
      debit: baseSalaries,
      credit: 0,
      label: `Salaires ${monthLabel}`
    },
    {
      accountCode: '6413',
      accountLabel: 'Indemnités et avantages divers',
      debit: payrollData.totalAllowances,
      credit: 0,
      label: `Indemnités ${monthLabel}`
    },
    {
      accountCode: '6451',
      accountLabel: 'Cotisations CNSS employeur',
      debit: payrollData.cnssEmployer,
      credit: 0,
      label: `CNSS patronale ${monthLabel}`
    },
    {
      accountCode: '6452',
      accountLabel: 'Cotisations AMU employeur',
      debit: payrollData.amuEmployer,
      credit: 0,
      label: `AMU patronale ${monthLabel}`
    },
    // Dettes sociales (crédit)
    {
      accountCode: '421',
      accountLabel: 'Personnel - Rémunérations dues',
      debit: 0,
      credit: payrollData.totalNet,
      label: `Salaires nets à payer ${monthLabel}`
    },
    {
      accountCode: '431',
      accountLabel: 'Sécurité sociale (CNSS)',
      debit: 0,
      credit: payrollData.cnssEmployee + payrollData.cnssEmployer,
      label: `CNSS ${monthLabel}`
    },
    {
      accountCode: '432',
      accountLabel: 'Assurance maladie (AMU)',
      debit: 0,
      credit: payrollData.amuEmployee + payrollData.amuEmployer,
      label: `AMU ${monthLabel}`
    },
    {
      accountCode: '442',
      accountLabel: 'État - Impôts et taxes (IRPP)',
      debit: 0,
      credit: payrollData.irpp,
      label: `IRPP ${monthLabel}`
    },
  ];

  return {
    id: `PAIE-${month}`,
    date: `${month}-28`,
    reference: `PAIE-${month}`,
    description: `Écriture de paie - ${monthLabel}`,
    lines: lines.filter(l => l.debit > 0 || l.credit > 0),
    status: 'draft',
    createdAt: now,
  };
}

export function calculateLedger(
  accountCode: string,
  entries: JournalEntry[]
): LedgerEntry[] {
  const ledger: LedgerEntry[] = [];
  let runningBalance = 0;

  const validatedEntries = entries
    .filter(e => e.status === 'validated')
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of validatedEntries) {
    for (const line of entry.lines) {
      if (line.accountCode === accountCode) {
        runningBalance += line.debit - line.credit;
        ledger.push({
          date: entry.date,
          reference: entry.reference,
          description: line.label || entry.description,
          debit: line.debit,
          credit: line.credit,
          balance: runningBalance,
        });
      }
    }
  }

  return ledger;
}

export function calculateBalance(entries: JournalEntry[]): BalanceEntry[] {
  const balanceMap = new Map<string, {
    label: string;
    debitMovement: number;
    creditMovement: number;
  }>();

  const validatedEntries = entries.filter(e => e.status === 'validated');

  for (const entry of validatedEntries) {
    for (const line of entry.lines) {
      const existing = balanceMap.get(line.accountCode) || {
        label: line.accountLabel,
        debitMovement: 0,
        creditMovement: 0,
      };
      existing.debitMovement += line.debit;
      existing.creditMovement += line.credit;
      balanceMap.set(line.accountCode, existing);
    }
  }

  return Array.from(balanceMap.entries())
    .map(([code, data]) => {
      const net = data.debitMovement - data.creditMovement;
      return {
        accountCode: code,
        accountLabel: data.label,
        debitMovement: data.debitMovement,
        creditMovement: data.creditMovement,
        debitBalance: net > 0 ? net : 0,
        creditBalance: net < 0 ? Math.abs(net) : 0,
      };
    })
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}
