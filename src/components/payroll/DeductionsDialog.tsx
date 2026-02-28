import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeductionType, SalaryDeduction } from "@/lib/mock-data";
import { formatCFA } from "@/lib/payroll-engine";
import { Plus, Trash2, AlertTriangle, Banknote, CreditCard, Scale } from "lucide-react";

const DEDUCTION_TYPES: { value: DeductionType; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: "avance", 
    label: "Avance sur salaire", 
    icon: <Banknote className="w-4 h-4" />,
    description: "Somme versée à l'employé avant la paie"
  },
  { 
    value: "acompte", 
    label: "Acompte", 
    icon: <CreditCard className="w-4 h-4" />,
    description: "Paiement partiel sur le salaire du mois"
  },
  { 
    value: "opposition", 
    label: "Opposition sur salaire", 
    icon: <Scale className="w-4 h-4" />,
    description: "Saisie-arrêt ordonnée par un tribunal"
  },
];

interface DeductionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  month: string;
  existingDeductions: SalaryDeduction[];
  onSave: (deductions: SalaryDeduction[]) => void;
}

interface DeductionEntry {
  id: string;
  type: DeductionType | "";
  description: string;
  amount: string;
  beneficiary: string;
  reference: string;
}

export function DeductionsDialog({
  open,
  onOpenChange,
  employeeName,
  month,
  existingDeductions,
  onSave,
}: DeductionsDialogProps) {
  const [deductions, setDeductions] = useState<DeductionEntry[]>(() => 
    existingDeductions
      .filter(d => d.month === month)
      .map(d => ({
        id: d.id,
        type: d.type,
        description: d.description,
        amount: d.amount.toString(),
        beneficiary: d.beneficiary || "",
        reference: d.reference || "",
      }))
  );

  const addDeduction = () => {
    setDeductions(prev => [
      ...prev,
      {
        id: `ded-${Date.now()}`,
        type: "",
        description: "",
        amount: "",
        beneficiary: "",
        reference: "",
      },
    ]);
  };

  const removeDeduction = (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id));
  };

  const updateDeduction = (id: string, field: keyof DeductionEntry, value: string) => {
    setDeductions(prev =>
      prev.map(d => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const handleSave = () => {
    const validDeductions: SalaryDeduction[] = deductions
      .filter(d => d.type && d.amount && parseInt(d.amount) > 0)
      .map(d => ({
        id: d.id,
        type: d.type as DeductionType,
        description: d.description.trim() || DEDUCTION_TYPES.find(t => t.value === d.type)?.label || "",
        amount: parseInt(d.amount),
        month,
        beneficiary: d.type === "opposition" ? d.beneficiary.trim() : undefined,
        reference: d.reference.trim() || undefined,
      }));

    // Keep deductions from other months
    const otherMonthDeductions = existingDeductions.filter(d => d.month !== month);
    onSave([...otherMonthDeductions, ...validDeductions]);
    onOpenChange(false);
  };

  const totalDeductions = deductions.reduce((sum, d) => sum + (parseInt(d.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Retenues sur salaire - {employeeName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Période: {new Date(month + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {deductions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Aucune retenue pour ce mois</p>
              <p className="text-xs">Cliquez sur "Ajouter une retenue" pour en créer une</p>
            </div>
          ) : (
            deductions.map((ded, index) => (
              <div key={ded.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Retenue #{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDeduction(ded.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type de retenue *</Label>
                    <Select
                      value={ded.type}
                      onValueChange={(value) => updateDeduction(ded.id, "type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEDUCTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              {type.icon}
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ded.type && (
                      <p className="text-xs text-muted-foreground">
                        {DEDUCTION_TYPES.find(t => t.value === ded.type)?.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Montant (FCFA) *</Label>
                    <Input
                      type="number"
                      value={ded.amount}
                      onChange={(e) => updateDeduction(ded.id, "amount", e.target.value)}
                      placeholder="100000"
                      min="0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description / Motif</Label>
                  <Textarea
                    value={ded.description}
                    onChange={(e) => updateDeduction(ded.id, "description", e.target.value)}
                    placeholder="Ex: Avance du 15/01/2025 pour raisons familiales"
                    rows={2}
                  />
                </div>

                {ded.type === "opposition" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bénéficiaire (créancier) *</Label>
                      <Input
                        value={ded.beneficiary}
                        onChange={(e) => updateDeduction(ded.id, "beneficiary", e.target.value)}
                        placeholder="Nom du créancier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Référence (ordonnance)</Label>
                      <Input
                        value={ded.reference}
                        onChange={(e) => updateDeduction(ded.id, "reference", e.target.value)}
                        placeholder="N° ordonnance tribunal"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          <Button type="button" variant="outline" onClick={addDeduction} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une retenue
          </Button>

          {totalDeductions > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm font-medium">Total des retenues</span>
              <span className="font-bold text-warning">{formatCFA(totalDeductions)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
