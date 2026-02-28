import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCFA, calculatePayroll, PayrollBreakdown, SalaryComponent, PayrollDeduction } from "@/lib/payroll-engine";
import { AlertTriangle, Edit3, Plus, Trash2 } from "lucide-react";
import { MaritalStatus } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayrollModificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  month: string;
  currentBreakdown: PayrollBreakdown;
  originalBaseSalary: number;
  originalComponents: SalaryComponent[];
  originalDeductions?: PayrollDeduction[];
  familyInfo?: { isMarried: boolean; numberOfChildren: number };
  workedDays?: number;
  onConfirm: (modifications: PayrollModifications, note: string, newBreakdown: PayrollBreakdown) => void;
}

export interface PayrollModifications {
  baseSalary: number;
  components: SalaryComponent[];
  deductions: PayrollDeduction[];
}

export function PayrollModificationDialog({
  open,
  onOpenChange,
  employeeName,
  month,
  currentBreakdown,
  originalBaseSalary,
  originalComponents,
  originalDeductions = [],
  familyInfo,
  workedDays,
  onConfirm,
}: PayrollModificationDialogProps) {
  const [note, setNote] = useState("");
  const [baseSalary, setBaseSalary] = useState(originalBaseSalary);
  const [components, setComponents] = useState<SalaryComponent[]>(originalComponents);
  const [deductions, setDeductions] = useState<PayrollDeduction[]>(originalDeductions);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setBaseSalary(originalBaseSalary);
      setComponents([...originalComponents]);
      setDeductions([...originalDeductions]);
      setNote("");
    }
  }, [open, originalBaseSalary, originalComponents, originalDeductions]);

  // Recalculate payroll when salary components or deductions change
  const newBreakdown = useMemo(() => {
    return calculatePayroll({
      baseSalary,
      components,
      deductions,
      familyInfo,
      workedDays,
    });
  }, [baseSalary, components, deductions, familyInfo, workedDays]);

  const handleConfirm = () => {
    if (!note.trim()) {
      return;
    }
    onConfirm({ baseSalary, components, deductions }, note.trim(), newBreakdown);
    setNote("");
    onOpenChange(false);
  };

  const handleComponentChange = (index: number, field: keyof SalaryComponent, value: string | boolean) => {
    setComponents(prev => prev.map((comp, i) => {
      if (i !== index) return comp;
      if (field === 'amount') {
        const numValue = parseInt(String(value).replace(/\s/g, ''), 10);
        return { ...comp, [field]: isNaN(numValue) ? 0 : numValue };
      }
      return { ...comp, [field]: value };
    }));
  };

  const handleAddComponent = () => {
    const newComponent: SalaryComponent = {
      id: `comp-mod-${Date.now()}`,
      name: "Nouvelle prime",
      amount: 0,
      isTaxable: true,
      includedInCNSS: true,
      includedInAMU: true,
      isRecurring: false,
    };
    setComponents(prev => [...prev, newComponent]);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  // Deduction handlers
  const handleDeductionChange = (index: number, field: keyof PayrollDeduction, value: string | number) => {
    setDeductions(prev => prev.map((ded, i) => {
      if (i !== index) return ded;
      if (field === 'amount') {
        const numValue = parseInt(String(value).replace(/\s/g, ''), 10);
        return { ...ded, [field]: isNaN(numValue) ? 0 : numValue };
      }
      return { ...ded, [field]: value };
    }));
  };

  const handleAddDeduction = () => {
    const newDeduction: PayrollDeduction = {
      id: `ded-mod-${Date.now()}`,
      type: "acompte",
      description: "Nouvelle retenue",
      amount: 0,
    };
    setDeductions(prev => [...prev, newDeduction]);
  };

  const handleRemoveDeduction = (index: number) => {
    setDeductions(prev => prev.filter((_, i) => i !== index));
  };

  const formatMonthLabel = (monthStr: string) => {
    const date = new Date(`${monthStr}-01`);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const hasChanges = 
    baseSalary !== originalBaseSalary ||
    JSON.stringify(components) !== JSON.stringify(originalComponents) ||
    JSON.stringify(deductions) !== JSON.stringify(originalDeductions);

  // Calculate differences for display
  const netDifference = newBreakdown.netAfterDeductions - currentBreakdown.netAfterDeductions;
  const grossDifference = newBreakdown.grossEarnings - currentBreakdown.grossEarnings;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-warning" />
            Modifier un bulletin validé
          </DialogTitle>
          <DialogDescription>
            {employeeName} - {formatMonthLabel(month)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-warning/10 text-warning-foreground rounded-lg border border-warning/30">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Attention</p>
              <p>Modifiez les composantes du salaire ou les retenues. Les cotisations et l'IRPP seront recalculés automatiquement.</p>
            </div>
          </div>

          {/* Base Salary */}
          <div className="space-y-2">
            <Label>Salaire de base</Label>
            <Input
              type="number"
              value={baseSalary}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\s/g, ''), 10);
                setBaseSalary(isNaN(val) ? 0 : val);
              }}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Actuel: {formatCFA(originalBaseSalary)}
            </p>
          </div>

          {/* Salary Components */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Indemnités et primes</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddComponent}>
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {components.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucune indemnité ou prime</p>
            )}

            {components.map((comp, index) => (
              <div key={comp.id} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Libellé</Label>
                    <Input
                      value={comp.name}
                      onChange={(e) => handleComponentChange(index, 'name', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Montant</Label>
                    <Input
                      type="number"
                      value={comp.amount}
                      onChange={(e) => handleComponentChange(index, 'amount', e.target.value)}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveComponent(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Deductions (Avances, Acomptes, Oppositions) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Retenues (Avances, Acomptes, Oppositions)</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddDeduction}>
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {deductions.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucune retenue non-taxable</p>
            )}

            {deductions.map((ded, index) => (
              <div key={ded.id} className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={ded.type}
                      onValueChange={(value) => handleDeductionChange(index, 'type', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acompte">Acompte</SelectItem>
                        <SelectItem value="avance">Avance</SelectItem>
                        <SelectItem value="opposition">Opposition</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={ded.description}
                      onChange={(e) => handleDeductionChange(index, 'description', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Montant</Label>
                    <Input
                      type="number"
                      value={ded.amount}
                      onChange={(e) => handleDeductionChange(index, 'amount', e.target.value)}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveDeduction(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Calculated Preview */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">Aperçu du recalcul</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Salaire brut</p>
                <p className="font-mono font-medium">{formatCFA(newBreakdown.grossEarnings)}</p>
                {grossDifference !== 0 && (
                  <p className={`text-xs ${grossDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {grossDifference > 0 ? '+' : ''}{formatCFA(grossDifference)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Retenues légales</p>
                <p className="font-mono font-medium">{formatCFA(newBreakdown.totalStatutoryDeductions)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">CNSS</p>
                <p className="font-mono">{formatCFA(newBreakdown.cnssEmployee)}</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">AMU</p>
                <p className="font-mono">{formatCFA(newBreakdown.amuEmployee)}</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">IRPP</p>
                <p className="font-mono">{formatCFA(newBreakdown.monthlyIRPP)}</p>
              </div>
            </div>

            {newBreakdown.totalOtherDeductions > 0 && (
              <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                <p className="text-xs text-muted-foreground mb-1">Autres retenues</p>
                <p className="font-mono text-sm">{formatCFA(newBreakdown.totalOtherDeductions)}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {newBreakdown.acomptes > 0 && <span className="mr-2">Acomptes: {formatCFA(newBreakdown.acomptes)}</span>}
                  {newBreakdown.avances > 0 && <span className="mr-2">Avances: {formatCFA(newBreakdown.avances)}</span>}
                  {newBreakdown.oppositions > 0 && <span>Oppositions: {formatCFA(newBreakdown.oppositions)}</span>}
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <p className="font-medium">Net à payer</p>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold">{formatCFA(newBreakdown.netAfterDeductions)}</p>
                  {netDifference !== 0 && (
                    <p className={`text-xs ${netDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netDifference > 0 ? '+' : ''}{formatCFA(netDifference)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-destructive">
              Motif de la modification *
            </Label>
            <Textarea
              id="note"
              placeholder="Décrivez la raison de cette correction (obligatoire)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!note.trim() || !hasChanges}
            variant="destructive"
          >
            Confirmer la modification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
