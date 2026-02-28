import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmployees, useDepartments, usePayrollRecords } from "@/hooks/use-local-data";
import { useAdvances } from "@/hooks/use-advances";
import { usePayrollLogs } from "@/hooks/use-payroll-logs";
import { useUser } from "@/contexts/UserContext";
import { calculatePayroll, formatCFA, PayrollDeduction, PayrollBreakdown } from "@/lib/payroll-engine";
import { PayrollBreakdownCard } from "@/components/payroll/PayrollBreakdownCard";
import { PayrollModificationDialog, PayrollModifications } from "@/components/payroll/PayrollModificationDialog";
import { PayrollLogsDialog } from "@/components/payroll/PayrollLogsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calculator, 
  Download, 
  CheckCircle, 
  Clock,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Banknote,
  Calendar,
  Edit3,
  History,
  ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PayrollRecord, Employee } from "@/lib/mock-data";
import { Link } from "react-router-dom";

// Generate month options dynamically
const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = date.toISOString().slice(0, 7);
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
};

/**
 * Calculate worked days based on hire date and end date for a given month
 * Uses 30 calendar days as the base
 */
function calculateWorkedDays(
  hireDate: string, 
  endDate: string | undefined, 
  selectedMonth: string
): number {
  const monthStart = new Date(`${selectedMonth}-01`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const daysInMonth = 30; // Using 30 calendar days as standard

  const hire = new Date(hireDate);
  const end = endDate ? new Date(endDate) : null;

  // If hired after this month, 0 days
  if (hire > monthEnd) return 0;

  // If left before this month, 0 days
  if (end && end < monthStart) return 0;

  let startDay = 1;
  let endDay = 30;

  // If hired during this month
  if (hire >= monthStart && hire <= monthEnd) {
    startDay = hire.getDate();
  }

  // If left during this month
  if (end && end >= monthStart && end <= monthEnd) {
    endDay = Math.min(end.getDate(), 30);
  }

  const workedDays = Math.max(0, endDay - startDay + 1);
  return Math.min(workedDays, daysInMonth);
}

interface EmployeePayrollItem {
  employee: Employee;
  record: PayrollRecord | undefined;
  breakdown: PayrollBreakdown;
  hasDeductions: boolean;
  autoWorkedDays: number;
  manualWorkedDays: number | null;
}

export default function Payroll() {
  // Default to current month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [workedDaysOverrides, setWorkedDaysOverrides] = useState<Record<string, number>>({});
  const [showModificationDialog, setShowModificationDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const { toast } = useToast();
  const { can } = useUser();

  const { employees, loading: loadingEmployees } = useEmployees();
  const { departments } = useDepartments();
  const { records, loading: loadingRecords, addRecord, updateRecord } = usePayrollRecords(selectedMonth);
  const { advances, loading: loadingAdvances } = useAdvances();

  const loading = loadingEmployees || loadingRecords || loadingAdvances;

  // Reset overrides when month changes
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setWorkedDaysOverrides({});
  };

  // Generate payroll data for all active employees hired before or during the selected month
  const employeePayrollData = useMemo((): EmployeePayrollItem[] => {
    const eligibleEmployees = employees.filter(e => {
      // Include active employees and those who left during or after this month
      if (e.status !== 'active' && e.status !== 'left') return false;
      
      // Only include employees hired before or during the selected month
      const hireMonth = e.hireDate.slice(0, 7);
      if (hireMonth > selectedMonth) return false;

      // For left employees, only include if they left during or after this month
      if (e.status === 'left' && e.endDate) {
        const endMonth = e.endDate.slice(0, 7);
        if (endMonth < selectedMonth) return false;
      }

      return true;
    });
    
    return eligibleEmployees.map(emp => {
      const existingRecord = records.find(r => r.employeeId === emp.id);
      
      // Calculate auto worked days based on dates
      const autoWorkedDays = calculateWorkedDays(emp.hireDate, emp.endDate, selectedMonth);
      const manualWorkedDays = workedDaysOverrides[emp.id] ?? null;
      const effectiveWorkedDays = manualWorkedDays !== null ? manualWorkedDays : autoWorkedDays;
      
      // Get deductions for this employee for the selected month
      const monthDeductions: PayrollDeduction[] = advances
        .filter(a => 
          a.employeeId === emp.id &&
          a.status !== 'cancelled' &&
          a.status !== 'paid' &&
          a.startMonth <= selectedMonth &&
          a.remainingBalance > 0
        )
        .map(a => ({
          id: a.id,
          type: a.type as "avance" | "acompte" | "opposition",
          description: a.description || (a.type === 'acompte' ? 'Acompte' : 'Avance sur salaire'),
          amount: Math.min(a.monthlyDeduction, a.remainingBalance),
        }));
      
      // Use modified values from record if validated, otherwise use original employee data
      const effectiveBaseSalary = existingRecord?.modifiedBaseSalary ?? emp.baseSalary;
      const effectiveComponents = existingRecord?.modifiedComponents ?? emp.salaryComponents;
      const effectiveDeductions = existingRecord?.modifiedDeductions ?? monthDeductions;
      
      const breakdown = calculatePayroll({
        baseSalary: effectiveBaseSalary,
        components: effectiveComponents,
        deductions: effectiveDeductions,
        familyInfo: {
          isMarried: emp.maritalStatus === 'married',
          numberOfChildren: emp.numberOfChildren || 0,
        },
        workedDays: effectiveWorkedDays,
      });
      
      return {
        employee: emp,
        record: existingRecord,
        breakdown,
        hasDeductions: effectiveDeductions.length > 0,
        autoWorkedDays,
        manualWorkedDays,
      };
    });
  }, [employees, records, selectedMonth, advances, workedDaysOverrides]);

  const handleWorkedDaysChange = (employeeId: string, value: string) => {
    const days = parseInt(value);
    if (isNaN(days)) {
      // Remove override
      setWorkedDaysOverrides(prev => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    } else {
      setWorkedDaysOverrides(prev => ({
        ...prev,
        [employeeId]: Math.max(0, Math.min(30, days)),
      }));
    }
  };

  const handleExportExcel = () => {
    toast({ title: "Export Excel", description: "Génération du fichier Excel... Fonctionnalité à venir." });
  };

  const handleValidateEmployee = async (employeeId: string) => {
    const empData = employeePayrollData.find(d => d.employee.id === employeeId);
    if (!empData) return;

    const { employee, record, breakdown } = empData;

    const newRecord: PayrollRecord = {
      id: record?.id || `pay-${employee.id}-${selectedMonth}`,
      employeeId: employee.id,
      month: selectedMonth,
      grossEarnings: breakdown.grossEarnings,
      cnssEmployee: breakdown.cnssEmployee,
      amuEmployee: breakdown.amuEmployee,
      irpp: breakdown.monthlyIRPP,
      familyChargeDeduction: breakdown.familyChargeDeduction,
      netSalary: breakdown.netAfterDeductions,
      cnssEmployer: breakdown.cnssEmployer,
      amuEmployer: breakdown.amuEmployer,
      totalCost: breakdown.totalEmployerCost,
      isValidated: true,
      validatedAt: new Date().toISOString(),
      validatedBy: "current-user",
      isApproved: false, // Requires admin approval after HR validation
    };

    if (record) {
      await updateRecord(newRecord);
    } else {
      await addRecord(newRecord);
    }

    toast({ 
      title: "Bulletin validé par RH", 
      description: `Le bulletin de ${employee.firstName} ${employee.lastName} est en attente d'approbation Admin.` 
    });
  };

  const handleApproveEmployee = async (employeeId: string) => {
    const empData = employeePayrollData.find(d => d.employee.id === employeeId);
    if (!empData?.record) return;

    const { employee, record } = empData;

    const approvedRecord: PayrollRecord = {
      ...record,
      isApproved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: "current-admin",
    };

    await updateRecord(approvedRecord);

    toast({ 
      title: "Bulletin approuvé", 
      description: `Le bulletin de ${employee.firstName} ${employee.lastName} a été approuvé par l'administrateur.` 
    });
  };

  const handleApproveAll = async () => {
    const pendingApproval = employeePayrollData.filter(d => d.record?.isValidated && !d.record?.isApproved);
    
    for (const empData of pendingApproval) {
      await handleApproveEmployee(empData.employee.id);
    }

    toast({ 
      title: "Approbation complète", 
      description: `${pendingApproval.length} bulletins approuvés pour ${selectedMonth}.` 
    });
  };

  const handleValidateAll = async () => {
    const pendingEmployees = employeePayrollData.filter(d => !d.record?.isValidated);
    
    for (const empData of pendingEmployees) {
      await handleValidateEmployee(empData.employee.id);
    }

    toast({ 
      title: "Validation complète", 
      description: `${pendingEmployees.length} bulletins validés pour ${selectedMonth}.` 
    });
  };

  const handleDownloadPDF = (employeeName: string) => {
    toast({ title: "Téléchargement PDF", description: `Bulletin de ${employeeName} - Fonctionnalité à venir.` });
  };

  // Handle modification of validated payroll
  const handleModifyPayroll = async (modifications: PayrollModifications, note: string, newBreakdown: PayrollBreakdown) => {
    if (!currentEmployeeData?.record) return;

    const { employee, record, breakdown } = currentEmployeeData;
    
    // Track changes for salary components
    const changes: { field: string; oldValue: number | string; newValue: number | string }[] = [];
    
    // Compare base salary
    if (modifications.baseSalary !== employee.baseSalary) {
      changes.push({ field: 'baseSalary', oldValue: employee.baseSalary, newValue: modifications.baseSalary });
    }
    
    // Compare salary components
    const oldComponentsStr = JSON.stringify(employee.salaryComponents);
    const newComponentsStr = JSON.stringify(modifications.components);
    if (oldComponentsStr !== newComponentsStr) {
      changes.push({ field: 'salaryComponents', oldValue: oldComponentsStr, newValue: newComponentsStr });
    }

    // Compare deductions
    const oldDeductionsStr = JSON.stringify(breakdown.deductionDetails);
    const newDeductionsStr = JSON.stringify(modifications.deductions);
    if (oldDeductionsStr !== newDeductionsStr) {
      changes.push({ field: 'deductions', oldValue: oldDeductionsStr, newValue: newDeductionsStr });
    }

    // Track calculated changes
    if (newBreakdown.grossEarnings !== record.grossEarnings) {
      changes.push({ field: 'grossEarnings', oldValue: record.grossEarnings, newValue: newBreakdown.grossEarnings });
    }
    if (newBreakdown.netAfterDeductions !== record.netSalary) {
      changes.push({ field: 'netSalary', oldValue: record.netSalary, newValue: newBreakdown.netAfterDeductions });
    }

    if (changes.length === 0) return;

    // Log the modification
    await addModificationLog({
      payrollRecordId: record.id,
      employeeId: employee.id,
      month: record.month,
      modifiedBy: "Admin",
      note,
      changes,
    });

    // Update the payroll record with new calculated values and store deductions
    const updatedRecord: PayrollRecord = {
      ...record,
      grossEarnings: newBreakdown.grossEarnings,
      cnssEmployee: newBreakdown.cnssEmployee,
      amuEmployee: newBreakdown.amuEmployee,
      irpp: newBreakdown.monthlyIRPP,
      familyChargeDeduction: newBreakdown.familyChargeDeduction,
      netSalary: newBreakdown.netAfterDeductions,
      cnssEmployer: newBreakdown.cnssEmployer,
      amuEmployer: newBreakdown.amuEmployer,
      totalCost: newBreakdown.totalEmployerCost,
      // Store the modified deductions and components for payslip generation
      modifiedDeductions: modifications.deductions,
      modifiedComponents: modifications.components,
      modifiedBaseSalary: modifications.baseSalary,
    };

    await updateRecord(updatedRecord);

    toast({
      title: "Bulletin modifié",
      description: `Le bulletin de ${employee.firstName} ${employee.lastName} a été corrigé et recalculé.`,
    });
  };

  const currentEmployeeData = selectedEmployee 
    ? employeePayrollData.find(d => d.employee.id === selectedEmployee) 
    : null;

  // Get logs for current employee's payroll record using the hook
  const { logs: currentPayrollLogs, addModificationLog } = usePayrollLogs(currentEmployeeData?.record?.id);
  // Summary calculations - use validated/modified record values if available, otherwise use breakdown
  const totalGross = employeePayrollData.reduce((sum, d) => 
    sum + (d.record?.isValidated ? d.record.grossEarnings : d.breakdown.grossEarnings), 0);
  const totalNet = employeePayrollData.reduce((sum, d) => 
    sum + (d.record?.isValidated ? d.record.netSalary : d.breakdown.netSalary), 0);
  const totalCNSS = employeePayrollData.reduce((sum, d) => 
    sum + (d.record?.isValidated 
      ? (d.record.cnssEmployee + d.record.cnssEmployer) 
      : (d.breakdown.cnssEmployee + d.breakdown.cnssEmployer)), 0);
  const totalAMU = employeePayrollData.reduce((sum, d) => 
    sum + (d.record?.isValidated 
      ? (d.record.amuEmployee + d.record.amuEmployer) 
      : (d.breakdown.amuEmployee + d.breakdown.amuEmployer)), 0);
  const totalIRPP = employeePayrollData.reduce((sum, d) => 
    sum + (d.record?.isValidated ? d.record.irpp : d.breakdown.monthlyIRPP), 0);
  const totalCost = employeePayrollData.reduce((sum, d) => 
    sum + (d.record?.isValidated ? d.record.totalCost : d.breakdown.totalEmployerCost), 0);

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
        title="Gestion de la paie" 
        description="Calculez et validez les bulletins de salaire"
        actions={
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("payroll:export") && (
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exporter Excel
              </Button>
            )}
            {can("payroll:validate") && (
              <Button size="sm" variant="secondary" onClick={handleValidateAll}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Valider RH
              </Button>
            )}
            {can("payroll:approve") && (
              <Button size="sm" onClick={handleApproveAll}>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Approuver Admin
              </Button>
            )}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card className="stat-card-success">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Brut total</p>
            <p className="text-lg font-bold">{formatCFA(totalGross)}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Net total</p>
            <p className="text-lg font-bold">{formatCFA(totalNet)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">CNSS total</p>
            <p className="text-lg font-bold">{formatCFA(totalCNSS)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">AMU total</p>
            <p className="text-lg font-bold">{formatCFA(totalAMU)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">IRPP total</p>
            <p className="text-lg font-bold">{formatCFA(totalIRPP)}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-warning">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Coût employeur</p>
            <p className="text-lg font-bold">{formatCFA(totalCost)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Calcul individuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Sélectionnez un employé pour voir le détail de sa paie
            </p>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {employeePayrollData.map(({ employee: emp, record, hasDeductions, breakdown }) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedEmployee === emp.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.position}</p>
                        {breakdown.prorataFactor < 1 && (
                          <p className="text-xs text-warning flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {breakdown.workedDays}/30 jours
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {breakdown.prorataFactor < 1 && (
                        <Calendar className="w-4 h-4 text-warning" />
                      )}
                      {hasDeductions && (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      )}
                      {record?.isApproved ? (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      ) : record?.isValidated ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Clock className="w-4 h-4 text-warning" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payroll Breakdown */}
        <div className="lg:col-span-2">
          {currentEmployeeData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {currentEmployeeData.employee.firstName} {currentEmployeeData.employee.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {departments.find(d => d.id === currentEmployeeData.employee.departmentId)?.name}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                  >
                    <Link to="/advances">
                      <Banknote className="w-4 h-4 mr-2" />
                      Avances
                      {currentEmployeeData.hasDeductions && (
                        <span className="ml-1 bg-warning text-warning-foreground text-xs px-1.5 py-0.5 rounded-full">
                          {currentEmployeeData.breakdown.deductionDetails.length}
                        </span>
                      )}
                    </Link>
                  </Button>
                  {currentEmployeeData.record?.isValidated && can("payroll:modify") && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowModificationDialog(true)}
                        className="text-warning border-warning hover:bg-warning/10"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      {currentPayrollLogs.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowLogsDialog(true)}
                        >
                          <History className="w-4 h-4 mr-2" />
                          Historique ({currentPayrollLogs.length})
                        </Button>
                      )}
                    </>
                  )}
                  {!currentEmployeeData.record?.isValidated && can("payroll:validate") && (
                    <Button size="sm" variant="secondary" onClick={() => handleValidateEmployee(currentEmployeeData.employee.id)}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Valider RH
                    </Button>
                  )}
                  {currentEmployeeData.record?.isValidated && !currentEmployeeData.record?.isApproved && can("payroll:approve") && (
                    <Button size="sm" onClick={() => handleApproveEmployee(currentEmployeeData.employee.id)}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Approuver
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(`${currentEmployeeData.employee.firstName} ${currentEmployeeData.employee.lastName}`)}>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger PDF
                  </Button>
                </div>
              </div>

              {/* Prorata Control */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Jours travaillés :</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={currentEmployeeData.manualWorkedDays !== null 
                          ? currentEmployeeData.manualWorkedDays 
                          : currentEmployeeData.autoWorkedDays}
                        onChange={(e) => handleWorkedDaysChange(currentEmployeeData.employee.id, e.target.value)}
                        className="w-20 h-8"
                        disabled={currentEmployeeData.record?.isValidated}
                      />
                      <span className="text-sm text-muted-foreground">/ 30 jours</span>
                    </div>
                    {currentEmployeeData.autoWorkedDays < 30 && (
                      <span className="text-xs text-muted-foreground">
                        (Auto-calculé: {currentEmployeeData.autoWorkedDays} jours basé sur les dates)
                      </span>
                    )}
                    {currentEmployeeData.breakdown.prorataFactor < 1 && (
                      <span className="text-xs bg-warning/20 text-warning-foreground px-2 py-1 rounded">
                        Prorata: {Math.round(currentEmployeeData.breakdown.prorataFactor * 100)}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Status display */}
              {currentEmployeeData.record?.isApproved ? (
                <div className="flex items-center justify-between gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Bulletin approuvé le {new Date(currentEmployeeData.record.approvedAt!).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Validé RH: {new Date(currentEmployeeData.record.validatedAt!).toLocaleDateString('fr-FR')}
                    </span>
                    {currentPayrollLogs.length > 0 && (
                      <span className="text-xs text-warning-foreground bg-warning/20 px-2 py-1 rounded">
                        {currentPayrollLogs.length} correction(s)
                      </span>
                    )}
                  </div>
                </div>
              ) : currentEmployeeData.record?.isValidated ? (
                <div className="flex items-center justify-between gap-2 text-sm text-success bg-success/10 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Validé RH le {new Date(currentEmployeeData.record.validatedAt!).toLocaleDateString('fr-FR')}</span>
                    <span className="text-warning-foreground bg-warning/20 px-2 py-1 rounded text-xs">
                      En attente approbation Admin
                    </span>
                  </div>
                  {currentPayrollLogs.length > 0 && (
                    <span className="text-xs text-warning-foreground bg-warning/20 px-2 py-1 rounded">
                      {currentPayrollLogs.length} correction(s)
                    </span>
                  )}
                </div>
              ) : null}
              <PayrollBreakdownCard breakdown={currentEmployeeData.breakdown} />
            </div>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16">
                <Calculator className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Sélectionnez un employé pour voir le détail du calcul de paie
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modification Dialog */}
      {currentEmployeeData && (
        <PayrollModificationDialog
          open={showModificationDialog}
          onOpenChange={setShowModificationDialog}
          employeeName={`${currentEmployeeData.employee.firstName} ${currentEmployeeData.employee.lastName}`}
          month={selectedMonth}
          currentBreakdown={currentEmployeeData.breakdown}
          originalBaseSalary={currentEmployeeData.record?.modifiedBaseSalary ?? currentEmployeeData.employee.baseSalary}
          originalComponents={currentEmployeeData.record?.modifiedComponents ?? currentEmployeeData.employee.salaryComponents}
          originalDeductions={currentEmployeeData.record?.modifiedDeductions ?? currentEmployeeData.breakdown.deductionDetails.map(d => ({
            id: `ded-${d.type}-${Date.now()}`,
            type: d.type as "avance" | "acompte" | "opposition",
            description: d.description,
            amount: d.amount,
            beneficiary: d.beneficiary,
          }))}
          familyInfo={{
            isMarried: currentEmployeeData.employee.maritalStatus === 'married',
            numberOfChildren: currentEmployeeData.employee.numberOfChildren || 0,
          }}
          workedDays={currentEmployeeData.manualWorkedDays ?? currentEmployeeData.autoWorkedDays}
          onConfirm={handleModifyPayroll}
        />
      )}

      {/* Logs Dialog */}
      <PayrollLogsDialog
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
        logs={currentPayrollLogs}
        employeeName={currentEmployeeData ? `${currentEmployeeData.employee.firstName} ${currentEmployeeData.employee.lastName}` : undefined}
      />

    </MainLayout>
  );
}
