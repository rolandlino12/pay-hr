import { PayrollBreakdown, formatCFA, TAX_CONFIG, formatPercent } from "@/lib/payroll-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, ArrowUp, Minus, AlertTriangle, Calendar } from "lucide-react";

interface PayrollBreakdownCardProps {
  breakdown: PayrollBreakdown;
  showEmployerCosts?: boolean;
}

const DEDUCTION_TYPE_LABELS: Record<string, string> = {
  avance: "Avance sur salaire",
  acompte: "Acompte",
  opposition: "Opposition sur salaire",
};

export function PayrollBreakdownCard({ breakdown, showEmployerCosts = true }: PayrollBreakdownCardProps) {
  const hasOtherDeductions = breakdown.totalOtherDeductions > 0;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg">Détail du bulletin de paie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prorata Notice */}
        {breakdown.prorataFactor < 1 && (
          <div className="flex items-center gap-2 text-sm bg-warning/10 text-warning-foreground px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4" />
            <span>
              Salaire au prorata : <strong>{breakdown.workedDays}/{breakdown.calendarDays} jours</strong> ({Math.round(breakdown.prorataFactor * 100)}%)
            </span>
          </div>
        )}

        {/* Earnings Section */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-success" />
            GAINS
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Salaire de base</span>
              <span className="font-medium">{formatCFA(breakdown.baseSalary)}</span>
            </div>
            {breakdown.componentBreakdown.map((comp, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {comp.name}
                  {!comp.isTaxable && (
                    <span className="ml-1 text-xs text-success">(non imposable)</span>
                  )}
                </span>
                <span>{formatCFA(comp.amount)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Salaire brut</span>
              <span className="amount-gross">{formatCFA(breakdown.grossEarnings)}</span>
            </div>
          </div>
        </div>

        {/* Statutory Deductions Section */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-destructive" />
            RETENUES LÉGALES
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                CNSS ({formatPercent(TAX_CONFIG.cnss.employee)})
              </span>
              <span className="text-destructive">-{formatCFA(breakdown.cnssEmployee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>
                AMU ({formatPercent(TAX_CONFIG.amu.employee)})
              </span>
              <span className="text-destructive">-{formatCFA(breakdown.amuEmployee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IRPP</span>
              <span className="text-destructive">-{formatCFA(breakdown.monthlyIRPP)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium text-sm">
              <span>Total retenues légales</span>
              <span className="text-destructive">-{formatCFA(breakdown.totalStatutoryDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Net Salary (before other deductions) */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-muted-foreground">Salaire net avant retenues</span>
            <span className="text-xl font-semibold">{formatCFA(breakdown.netSalary)}</span>
          </div>
        </div>

        {/* Other Deductions Section (if any) */}
        {hasOtherDeductions && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              AUTRES RETENUES
            </h4>
            <div className="space-y-2">
              {breakdown.deductionDetails.map((deduction, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {DEDUCTION_TYPE_LABELS[deduction.type] || deduction.type}
                    {deduction.description && (
                      <span className="ml-1 text-xs">({deduction.description})</span>
                    )}
                    {deduction.beneficiary && (
                      <span className="ml-1 text-xs text-warning">→ {deduction.beneficiary}</span>
                    )}
                  </span>
                  <span className="text-warning">-{formatCFA(deduction.amount)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-medium text-sm">
                <span>Total autres retenues</span>
                <span className="text-warning">-{formatCFA(breakdown.totalOtherDeductions)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Final Net Amount */}
        <div className="bg-primary/5 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">NET À PAYER</span>
            <span className="text-2xl font-bold text-primary">{formatCFA(breakdown.netAfterDeductions)}</span>
          </div>
          {hasOtherDeductions && (
            <p className="text-xs text-muted-foreground mt-1">
              Après déduction des avances, acomptes et oppositions
            </p>
          )}
        </div>

        {/* Employer Costs */}
        {showEmployerCosts && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Minus className="w-4 h-4" />
              CHARGES PATRONALES
            </h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>CNSS employeur ({formatPercent(TAX_CONFIG.cnss.employer)})</span>
                <span>{formatCFA(breakdown.cnssEmployer)}</span>
              </div>
              <div className="flex justify-between">
                <span>AMU employeur ({formatPercent(TAX_CONFIG.amu.employer)})</span>
                <span>{formatCFA(breakdown.amuEmployer)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium text-foreground">
                <span>Coût total employeur</span>
                <span>{formatCFA(breakdown.totalEmployerCost)}</span>
              </div>
            </div>
          </div>
        )}

        {/* IRPP Details */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p><strong>Revenu brut imposable:</strong> {formatCFA(breakdown.grossTaxableIncome)}</p>
          <p><strong>Abattement forfaitaire (28%):</strong> -{formatCFA(breakdown.abatementAmount)}</p>
          <p><strong>Revenu net imposable:</strong> {formatCFA(breakdown.netTaxableIncome)}</p>
          <p><strong>Base annuelle (arrondie):</strong> {formatCFA(breakdown.annualTaxableIncome)}</p>
          <p><strong>IRPP annuel brut:</strong> {formatCFA(breakdown.annualIRPPBeforeDeductions)}</p>
          {breakdown.familyInfo.totalDependents > 0 && (
            <>
              <p>
                <strong>Charges de famille:</strong> {breakdown.familyInfo.isMarried ? 'Marié(e)' : 'Célibataire'}
                {breakdown.familyInfo.numberOfChildren > 0 && ` + ${breakdown.familyInfo.numberOfChildren} enfant(s)`}
                {' '}({breakdown.familyInfo.totalDependents} pers. à charge)
              </p>
              <p><strong>Réduction mensuelle:</strong> -{formatCFA(breakdown.familyChargeDeduction)}</p>
            </>
          )}
          <p><strong>IRPP annuel net:</strong> {formatCFA(breakdown.annualIRPP)}</p>
          <p><strong>IRPP mensuel:</strong> {formatCFA(breakdown.monthlyIRPP)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
