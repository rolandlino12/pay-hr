import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAdvances } from "@/hooks/use-advances";
import { useEmployees } from "@/hooks/use-local-data";
import { 
  Advance, 
  AdvanceType, 
  calculateMonthlyDeduction, 
  exceedsLegalLimit, 
  getLegalLimitWarning, 
  exceedsAcompteLimit,
  getAcompteLimitWarning,
  generateAdvanceId, 
  getAdvanceTypeLabel, 
  getAdvanceStatusLabel, 
  getAdvanceStatusColor,
  getCurrentMonth,
  getNextMonth,
} from "@/lib/advances";
import { formatCFA } from "@/lib/payroll-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  AlertTriangle, 
  Banknote, 
  CreditCard, 
  Loader2,
  XCircle,
  CheckCircle,
  Clock,
  TrendingDown,
  Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Advances() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [advanceToCancel, setAdvanceToCancel] = useState<Advance | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  
  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [advanceType, setAdvanceType] = useState<AdvanceType>("acompte");
  const [amount, setAmount] = useState("");
  const [numberOfMonths, setNumberOfMonths] = useState("1");
  const [description, setDescription] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  
  const { toast } = useToast();
  const { advances, loading: loadingAdvances, addAdvance, updateAdvance } = useAdvances();
  const { employees, loading: loadingEmployees } = useEmployees();
  
  const loading = loadingAdvances || loadingEmployees;
  
  // Get selected employee
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);
  
  // Calculate monthly deduction
  const monthlyDeduction = useMemo(() => {
    const totalAmount = parseFloat(amount) || 0;
    const months = advanceType === 'acompte' ? 1 : parseInt(numberOfMonths) || 1;
    return calculateMonthlyDeduction(totalAmount, months);
  }, [amount, advanceType, numberOfMonths]);
  
  // Check legal limit (1/10th rule)
  const legalWarning = useMemo(() => {
    if (!selectedEmployee) return null;
    return getLegalLimitWarning(monthlyDeduction, selectedEmployee.baseSalary);
  }, [selectedEmployee, monthlyDeduction]);
  
  // Check acompte limit (1/3 rule)
  const acompteWarning = useMemo(() => {
    if (!selectedEmployee || advanceType !== 'acompte') return null;
    const totalAmount = parseFloat(amount) || 0;
    return getAcompteLimitWarning(totalAmount, selectedEmployee.baseSalary);
  }, [selectedEmployee, advanceType, amount]);
  
  // Filter advances by status for tabs
  const activeAdvances = useMemo(() => 
    advances.filter(a => a.status === 'active' || a.status === 'pending'), 
    [advances]
  );
  const paidAdvances = useMemo(() => 
    advances.filter(a => a.status === 'paid'), 
    [advances]
  );
  const cancelledAdvances = useMemo(() => 
    advances.filter(a => a.status === 'cancelled'), 
    [advances]
  );
  
  // Summary stats
  const totalActiveAmount = useMemo(() => 
    activeAdvances.reduce((sum, a) => sum + a.remainingBalance, 0), 
    [activeAdvances]
  );
  const totalMonthlyDeductions = useMemo(() => 
    activeAdvances.reduce((sum, a) => sum + Math.min(a.monthlyDeduction, a.remainingBalance), 0), 
    [activeAdvances]
  );
  
  const resetForm = () => {
    setSelectedEmployeeId("");
    setAdvanceType("acompte");
    setAmount("");
    setNumberOfMonths("1");
    setDescription("");
    setBeneficiary("");
  };
  
  const handleSubmit = async () => {
    if (!selectedEmployeeId || !amount) {
      toast({ 
        title: "Erreur", 
        description: "Veuillez remplir tous les champs obligatoires.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (advanceType === 'opposition' && !beneficiary.trim()) {
      toast({ 
        title: "Erreur", 
        description: "Veuillez indiquer le bénéficiaire de l'opposition.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Check acompte 1/3 limit
    if (advanceType === 'acompte' && selectedEmployee) {
      const totalAmount = parseFloat(amount);
      if (exceedsAcompteLimit(totalAmount, selectedEmployee.baseSalary)) {
        toast({ 
          title: "Montant non autorisé", 
          description: `L'acompte ne peut pas dépasser 1/3 du salaire de base (${Math.floor(selectedEmployee.baseSalary / 3).toLocaleString('fr-FR')} FCFA).`, 
          variant: "destructive" 
        });
        return;
      }
    }
    
    const totalAmount = parseFloat(amount);
    const months = advanceType === 'acompte' ? 1 : parseInt(numberOfMonths) || 1;
    const currentMonth = getCurrentMonth();
    // Acompte: déduit ce mois, Avance/Opposition: commence le mois prochain
    const startMonth = advanceType === 'acompte' ? currentMonth : getNextMonth(currentMonth);
    
    const newAdvance: Advance = {
      id: generateAdvanceId(),
      employeeId: selectedEmployeeId,
      type: advanceType,
      totalAmount,
      remainingBalance: totalAmount,
      monthlyDeduction: calculateMonthlyDeduction(totalAmount, months),
      numberOfMonths: months,
      startMonth,
      createdAt: new Date().toISOString(),
      status: advanceType === 'acompte' ? 'active' : 'pending',
      description: description || undefined,
      beneficiary: advanceType === 'opposition' ? beneficiary : undefined,
    };
    
    await addAdvance(newAdvance);
    
    const employeeName = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '';
    toast({ 
      title: advanceType === 'acompte' ? "Acompte enregistré" : "Avance enregistrée", 
      description: `${getAdvanceTypeLabel(advanceType)} de ${formatCFA(totalAmount)} pour ${employeeName}.` 
    });
    
    resetForm();
    setDialogOpen(false);
  };
  
  const handleCancelAdvance = async () => {
    if (!advanceToCancel) return;
    
    await updateAdvance({
      ...advanceToCancel,
      status: 'cancelled',
    });
    
    toast({ 
      title: "Avance annulée", 
      description: "L'avance a été annulée avec succès." 
    });
    
    setAdvanceToCancel(null);
    setCancelDialogOpen(false);
  };
  
  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : '-';
  };
  
  const getEmployeeBaseSalary = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.baseSalary || 0;
  };
  
  const renderAdvanceTable = (advancesList: Advance[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employé</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Montant total</TableHead>
          <TableHead className="text-right">Solde restant</TableHead>
          <TableHead className="text-right">Déduction mensuelle</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {advancesList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              Aucune avance dans cette catégorie
            </TableCell>
          </TableRow>
        ) : (
          advancesList.map(advance => {
            const hasLegalWarning = exceedsLegalLimit(
              advance.monthlyDeduction, 
              getEmployeeBaseSalary(advance.employeeId)
            );
            
            return (
              <TableRow key={advance.id}>
                <TableCell className="font-medium">
                  {getEmployeeName(advance.employeeId)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {advance.type === 'acompte' ? (
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    ) : advance.type === 'avance' ? (
                      <Banknote className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Scale className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                      <span>{getAdvanceTypeLabel(advance.type)}</span>
                      {advance.beneficiary && (
                        <span className="text-xs text-muted-foreground">→ {advance.beneficiary}</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCFA(advance.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCFA(advance.remainingBalance)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <div className="flex items-center justify-end gap-1">
                    {hasLegalWarning && (
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    )}
                    {formatCFA(Math.min(advance.monthlyDeduction, advance.remainingBalance))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-xs", getAdvanceStatusColor(advance.status))}>
                    {getAdvanceStatusLabel(advance.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {(advance.status === 'active' || advance.status === 'pending') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setAdvanceToCancel(advance);
                        setCancelDialogOpen(true);
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
  
  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <PageHeader 
        title="Avances, Acomptes & Oppositions" 
        description="Gérez les avances sur salaire, acomptes et oppositions des employés"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle avance
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Enregistrer une avance</DialogTitle>
                <DialogDescription>
                  Créez un acompte (remboursement immédiat) ou une avance (remboursement échelonné).
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4 overflow-y-auto flex-1">
                {/* Employee Selector */}
                <div className="space-y-2">
                  <Label htmlFor="employee">Employé *</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un employé" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter(e => e.status === 'active')
                        .map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName} - {emp.position}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedEmployee && (
                    <p className="text-xs text-muted-foreground">
                      Salaire de base: {formatCFA(selectedEmployee.baseSalary)}
                    </p>
                  )}
                </div>
                
                {/* Type Toggle */}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={advanceType === 'acompte' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => {
                        setAdvanceType('acompte');
                        setNumberOfMonths("1");
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Acompte
                    </Button>
                    <Button
                      type="button"
                      variant={advanceType === 'avance' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setAdvanceType('avance')}
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      Avance
                    </Button>
                    <Button
                      type="button"
                      variant={advanceType === 'opposition' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setAdvanceType('opposition')}
                    >
                      <Scale className="w-4 h-4 mr-2" />
                      Opposition
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {advanceType === 'acompte' 
                      ? "L'acompte sera déduit du prochain bulletin de salaire."
                      : advanceType === 'avance'
                      ? "L'avance sera remboursée sur plusieurs mois."
                      : "Opposition sur salaire (saisie-arrêt) au profit d'un créancier."}
                  </p>
                </div>
                
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (FCFA) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Ex: 100000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                
                {/* Number of Months (for avance and opposition) */}
                {(advanceType === 'avance' || advanceType === 'opposition') && (
                  <div className="space-y-2">
                    <Label htmlFor="months">Nombre de mois de remboursement</Label>
                    <Input
                      id="months"
                      type="number"
                      min="2"
                      max="60"
                      value={numberOfMonths}
                      onChange={(e) => setNumberOfMonths(e.target.value)}
                    />
                  </div>
                )}
                
                {/* Beneficiary (for opposition only) */}
                {advanceType === 'opposition' && (
                  <div className="space-y-2">
                    <Label htmlFor="beneficiary">Bénéficiaire (créancier) *</Label>
                    <Input
                      id="beneficiary"
                      placeholder="Ex: Banque XYZ, Tribunal de Lomé"
                      value={beneficiary}
                      onChange={(e) => setBeneficiary(e.target.value)}
                    />
                  </div>
                )}
                
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optionnel)</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Avance pour frais médicaux"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                
                {/* Monthly Deduction Display */}
                {amount && parseFloat(amount) > 0 && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Déduction mensuelle:</span>
                      <span className="font-semibold">{formatCFA(monthlyDeduction)}</span>
                    </div>
                    {(advanceType === 'avance' || advanceType === 'opposition') && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Durée:</span>
                        <span>{numberOfMonths} mois</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Acompte 1/3 Warning */}
                {acompteWarning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{acompteWarning}</p>
                  </div>
                )}
                
                {/* Legal 1/10th Warning */}
                {legalWarning && !acompteWarning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warning">{legalWarning}</p>
                  </div>
                )}
              </div>
              
              <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSubmit}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avances actives</p>
                <p className="text-xl font-bold">{activeAdvances.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Solde total à recouvrer</p>
                <p className="text-xl font-bold">{formatCFA(totalActiveAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Banknote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Déductions ce mois</p>
                <p className="text-xl font-bold">{formatCFA(totalMonthlyDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avances remboursées</p>
                <p className="text-xl font-bold">{paidAdvances.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Advances Table with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des avances</CardTitle>
          <CardDescription>
            Suivez l'état des avances et acomptes de vos employés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="gap-2">
                <Clock className="w-4 h-4" />
                En cours ({activeAdvances.length})
              </TabsTrigger>
              <TabsTrigger value="paid" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Remboursées ({paidAdvances.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="gap-2">
                <XCircle className="w-4 h-4" />
                Annulées ({cancelledAdvances.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active">
              {renderAdvanceTable(activeAdvances)}
            </TabsContent>
            <TabsContent value="paid">
              {renderAdvanceTable(paidAdvances)}
            </TabsContent>
            <TabsContent value="cancelled">
              {renderAdvanceTable(cancelledAdvances)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette avance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action annulera l'avance et arrêtera les déductions futures. 
              Le solde restant ({advanceToCancel ? formatCFA(advanceToCancel.remainingBalance) : ''}) ne sera plus déduit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non, conserver</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelAdvance}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Oui, annuler l'avance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
