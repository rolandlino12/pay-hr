import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePayrollRecords, useEmployees } from "@/hooks/use-local-data";
import { useUser } from "@/contexts/UserContext";
import { formatCFA, calculatePayroll, PayrollBreakdown } from "@/lib/payroll-engine";
import { downloadPayslip, downloadBlob, generatePayslipHTML } from "@/lib/file-utils";
import { getById, update as updateRecord } from "@/lib/local-storage";
import { PayrollModificationDialog, PayrollModifications } from "@/components/payroll/PayrollModificationDialog";
import { PayrollLogsDialog } from "@/components/payroll/PayrollLogsDialog";
import { 
  PayrollModificationLog,
  getLogsForPayrollRecord, 
  addPayrollModificationLog 
} from "@/lib/payroll-logs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Download, 
  FileText, 
  Printer,
  Mail,
  CheckCircle,
  Clock,
  Loader2,
  Calendar,
  Edit3,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PayrollRecord } from "@/lib/mock-data";

interface CompanySettings {
  name: string;
  address?: string;
  nif?: string;
  cnssNumber?: string;
  logo?: string;
}

interface StoredCompanySettings {
  companyName: string;
  address?: string;
  nif?: string;
  cnssNumber?: string;
  logo?: string;
}

// Generate list of months (last 12 months + current)
const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = format(date, "yyyy-MM");
    const label = format(date, "MMMM yyyy", { locale: fr });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
};

const monthOptions = generateMonthOptions();

export default function Payslips() {
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const { records, loading: loadingRecords, refresh } = usePayrollRecords(selectedMonth);
  const { employees, loading: loadingEmployees } = useEmployees();
  const { toast } = useToast();
  const { can } = useUser();
  const [company, setCompany] = useState<CompanySettings>({ name: 'Entreprise' });
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showModificationDialog, setShowModificationDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [recordLogs, setRecordLogs] = useState<Map<string, PayrollModificationLog[]>>(new Map());

  const loading = loadingRecords || loadingEmployees;

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Load company settings
  useEffect(() => {
    const loadCompany = async () => {
      const settings = await getById("settings", "company_info");
      if (settings?.value) {
        const stored = settings.value as StoredCompanySettings;
        setCompany({
          name: stored.companyName || 'Entreprise',
          address: stored.address,
          nif: stored.nif,
          cnssNumber: stored.cnssNumber,
          logo: stored.logo
        });
      }
    };
    loadCompany();
  }, []);

  // Load logs for all records when records change
  const loadAllLogs = useCallback(async () => {
    const logsMap = new Map<string, PayrollModificationLog[]>();
    for (const record of records) {
      const logs = await getLogsForPayrollRecord(record.id);
      if (logs.length > 0) {
        logsMap.set(record.id, logs);
      }
    }
    setRecordLogs(logsMap);
  }, [records]);

  useEffect(() => {
    if (records.length > 0) {
      loadAllLogs();
    }
  }, [records, loadAllLogs]);

  // Helper to get logs for a specific record
  const getLogsForRecord = (recordId: string): PayrollModificationLog[] => {
    return recordLogs.get(recordId) || [];
  };

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const handleSendAllEmail = () => {
    toast({ title: "Info", description: `L'envoi par email nécessite une configuration serveur.` });
  };

  const handlePrintAll = () => {
    // Generate all payslips as one printable document
    const allHtml = records.map(record => {
      const employee = getEmployee(record.employeeId);
      if (!employee) return '';
      const logs = getLogsForRecord(record.id);
      const modifications = logs.length > 0 ? logs.map(l => ({ date: l.modifiedAt, note: l.note })) : undefined;
      const baseSalary = record.modifiedBaseSalary ?? employee.baseSalary;
      const components = record.modifiedComponents ?? employee.salaryComponents;
      const otherDeductions = record.modifiedDeductions?.map(d => ({
        type: d.type,
        description: d.description,
        amount: d.amount
      }));
      
      return generatePayslipHTML(
        { firstName: employee.firstName, lastName: employee.lastName, matricule: employee.matricule, position: employee.position, phone: employee.phone, cnssNumber: employee.cnssNumber, nif: employee.nif },
        { 
          month: record.month, 
          baseSalary, 
          grossEarnings: record.grossEarnings, 
          netSalary: record.netSalary,
          cnssEmployee: record.cnssEmployee,
          amuEmployee: record.amuEmployee,
          irpp: record.irpp,
          familyChargeDeduction: record.familyChargeDeduction,
          components: components.map(c => ({ name: c.name, amount: c.amount })),
          otherDeductions,
          modifications
        },
        company
      );
    }).join('<div style="page-break-after: always;"></div>');
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(allHtml);
      printWindow.document.close();
      printWindow.print();
    }
    toast({ title: "Impression", description: "Fenêtre d'impression ouverte." });
  };

  const handleDownloadAll = () => {
    // Download each payslip
    records.forEach(record => {
      const employee = getEmployee(record.employeeId);
      if (!employee) return;
      const logs = getLogsForRecord(record.id);
      const modifications = logs.length > 0 ? logs.map(l => ({ date: l.modifiedAt, note: l.note })) : undefined;
      const baseSalary = record.modifiedBaseSalary ?? employee.baseSalary;
      const components = record.modifiedComponents ?? employee.salaryComponents;
      const otherDeductions = record.modifiedDeductions?.map(d => ({
        type: d.type,
        description: d.description,
        amount: d.amount
      }));
      
      downloadPayslip(
        { firstName: employee.firstName, lastName: employee.lastName, matricule: employee.matricule, position: employee.position, phone: employee.phone, cnssNumber: employee.cnssNumber, nif: employee.nif },
        { 
          month: record.month, 
          baseSalary, 
          grossEarnings: record.grossEarnings, 
          netSalary: record.netSalary,
          cnssEmployee: record.cnssEmployee,
          amuEmployee: record.amuEmployee,
          irpp: record.irpp,
          familyChargeDeduction: record.familyChargeDeduction,
          components: components.map(c => ({ name: c.name, amount: c.amount })),
          otherDeductions,
          modifications
        },
        company
      );
    });
    toast({ title: "Téléchargement", description: `${records.length} bulletins téléchargés.` });
  };

  const handleDownloadSingle = (employeeId: string) => {
    const employee = getEmployee(employeeId);
    const record = records.find(r => r.employeeId === employeeId);
    if (!employee || !record) return;
    
    const logs = getLogsForRecord(record.id);
    const modifications = logs.length > 0 ? logs.map(l => ({ date: l.modifiedAt, note: l.note })) : undefined;
    const baseSalary = record.modifiedBaseSalary ?? employee.baseSalary;
    const components = record.modifiedComponents ?? employee.salaryComponents;
    const otherDeductions = record.modifiedDeductions?.map(d => ({
      type: d.type,
      description: d.description,
      amount: d.amount
    }));
    
    downloadPayslip(
      { firstName: employee.firstName, lastName: employee.lastName, matricule: employee.matricule, position: employee.position, phone: employee.phone, cnssNumber: employee.cnssNumber, nif: employee.nif },
      { 
        month: record.month, 
        baseSalary, 
        grossEarnings: record.grossEarnings, 
        netSalary: record.netSalary,
        cnssEmployee: record.cnssEmployee,
        amuEmployee: record.amuEmployee,
        irpp: record.irpp,
        familyChargeDeduction: record.familyChargeDeduction,
        components: components.map(c => ({ name: c.name, amount: c.amount })),
        otherDeductions,
        modifications
      },
      company
    );
    toast({ title: "Téléchargement", description: `Bulletin de ${employee.firstName} ${employee.lastName} téléchargé.` });
  };

  const handleSendSingleEmail = (employeeName: string) => {
    toast({ title: "Info", description: `L'envoi par email nécessite une configuration serveur.` });
  };

  // Get selected record for modification
  const selectedRecord = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;
  const selectedEmployee = selectedRecord ? getEmployee(selectedRecord.employeeId) : null;
  const selectedRecordLogs = selectedRecord ? getLogsForRecord(selectedRecord.id) : [];

  // Create a mock breakdown for the modification dialog
  const getBreakdownForRecord = (record: PayrollRecord): PayrollBreakdown => {
    return {
      baseSalary: 0,
      totalAllowances: 0,
      totalBonuses: 0,
      grossEarnings: record.grossEarnings,
      cnssBase: record.grossEarnings,
      amuBase: record.grossEarnings,
      cnssEmployee: record.cnssEmployee,
      amuEmployee: record.amuEmployee,
      cnssEmployer: record.cnssEmployer,
      amuEmployer: record.amuEmployer,
      grossTaxableIncome: 0,
      abatementAmount: 0,
      netTaxableIncome: 0,
      monthlyTaxableIncome: 0,
      roundedMonthlyTaxableIncome: 0,
      annualTaxableIncome: 0,
      annualIRPPBeforeDeductions: 0,
      familyChargeDeduction: record.familyChargeDeduction || 0,
      annualIRPP: 0,
      monthlyIRPP: record.irpp,
      totalStatutoryDeductions: record.cnssEmployee + record.amuEmployee + record.irpp,
      avances: 0,
      acomptes: 0,
      oppositions: 0,
      totalOtherDeductions: 0,
      deductionDetails: [],
      totalDeductions: 0,
      netSalary: record.netSalary,
      netAfterDeductions: record.netSalary,
      totalEmployerContributions: record.cnssEmployer + record.amuEmployer,
      totalEmployerCost: record.totalCost,
      workedDays: 30,
      calendarDays: 30,
      prorataFactor: 1,
      componentBreakdown: [],
      familyInfo: { isMarried: false, numberOfChildren: 0, totalDependents: 0 },
    };
  };

  // Handle modification of validated payroll
  const handleModifyPayroll = async (modifications: PayrollModifications, note: string, newBreakdown: PayrollBreakdown) => {
    if (!selectedRecord || !selectedEmployee) return;

    // Track changes for salary components
    const changes: { field: string; oldValue: number | string; newValue: number | string }[] = [];
    
    // Compare base salary
    const currentBaseSalary = selectedRecord.modifiedBaseSalary ?? selectedEmployee.baseSalary;
    if (modifications.baseSalary !== currentBaseSalary) {
      changes.push({ field: 'baseSalary', oldValue: currentBaseSalary, newValue: modifications.baseSalary });
    }
    
    // Compare salary components
    const currentComponents = selectedRecord.modifiedComponents ?? selectedEmployee.salaryComponents;
    const oldComponentsStr = JSON.stringify(currentComponents);
    const newComponentsStr = JSON.stringify(modifications.components);
    if (oldComponentsStr !== newComponentsStr) {
      changes.push({ field: 'salaryComponents', oldValue: oldComponentsStr, newValue: newComponentsStr });
    }

    // Compare deductions
    const currentDeductions = selectedRecord.modifiedDeductions ?? [];
    const oldDeductionsStr = JSON.stringify(currentDeductions);
    const newDeductionsStr = JSON.stringify(modifications.deductions);
    if (oldDeductionsStr !== newDeductionsStr) {
      changes.push({ field: 'deductions', oldValue: oldDeductionsStr, newValue: newDeductionsStr });
    }

    // Track calculated changes
    if (newBreakdown.grossEarnings !== selectedRecord.grossEarnings) {
      changes.push({ field: 'grossEarnings', oldValue: selectedRecord.grossEarnings, newValue: newBreakdown.grossEarnings });
    }
    if (newBreakdown.netAfterDeductions !== selectedRecord.netSalary) {
      changes.push({ field: 'netSalary', oldValue: selectedRecord.netSalary, newValue: newBreakdown.netAfterDeductions });
    }

    if (changes.length === 0) return;

    // Log the modification
    await addPayrollModificationLog({
      payrollRecordId: selectedRecord.id,
      employeeId: selectedEmployee.id,
      month: selectedRecord.month,
      modifiedBy: "Admin",
      note,
      changes,
    });

    // Update the payroll record with new calculated values and modified data
    const updatedRecord: PayrollRecord = {
      ...selectedRecord,
      grossEarnings: newBreakdown.grossEarnings,
      cnssEmployee: newBreakdown.cnssEmployee,
      amuEmployee: newBreakdown.amuEmployee,
      irpp: newBreakdown.monthlyIRPP,
      familyChargeDeduction: newBreakdown.familyChargeDeduction,
      netSalary: newBreakdown.netAfterDeductions,
      cnssEmployer: newBreakdown.cnssEmployer,
      amuEmployer: newBreakdown.amuEmployer,
      totalCost: newBreakdown.totalEmployerCost,
      modifiedBaseSalary: modifications.baseSalary,
      modifiedComponents: modifications.components,
      modifiedDeductions: modifications.deductions,
    };

    await updateRecord("payrollRecords", updatedRecord);
    await refresh();
    await loadAllLogs(); // Reload logs after modification

    toast({
      title: "Bulletin modifié",
      description: `Le bulletin de ${selectedEmployee.firstName} ${selectedEmployee.lastName} a été corrigé et recalculé.`,
    });

    setSelectedRecordId(null);
  };

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
        title="Bulletins de paie" 
        description="Générez et distribuez les bulletins de salaire"
        actions={
          <div className="flex items-center gap-2">
            {can("payslip:email") && (
              <Button variant="outline" size="sm" onClick={handleSendAllEmail}>
                <Mail className="w-4 h-4 mr-2" />
                Envoyer par email
              </Button>
            )}
            {can("payslip:print") && (
              <Button variant="outline" size="sm" onClick={handlePrintAll}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer tout
              </Button>
            )}
            {can("payslip:download") && (
              <Button size="sm" onClick={handleDownloadAll}>
                <Download className="w-4 h-4 mr-2" />
                Télécharger tout (ZIP)
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Période :</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {selectedMonthLabel} – {records.length} bulletins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="data-table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Employé</th>
                <th className="text-right">Brut</th>
                <th className="text-right">Retenues</th>
                <th className="text-right">Net</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="w-12 h-12 opacity-30" />
                      <p className="font-medium">Aucun bulletin pour {selectedMonthLabel}</p>
                      <p className="text-sm">Validez d'abord la paie sur la page Paie pour générer les bulletins.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const employee = getEmployee(record.employeeId);
                  if (!employee) return null;
                  
                  const totalDeductions = record.cnssEmployee + record.amuEmployee + record.irpp;
                  
                  return (
                    <tr key={record.id}>
                      <td className="font-mono text-xs">{employee.matricule}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {employee.firstName[0]}{employee.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                            <p className="text-xs text-muted-foreground">{employee.position}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right amount-gross">{formatCFA(record.grossEarnings)}</td>
                      <td className="text-right amount-deduction">-{formatCFA(totalDeductions)}</td>
                      <td className="text-right amount-net">{formatCFA(record.netSalary)}</td>
                      <td>
                        {record.isValidated ? (
                          <span className="status-active">
                            <CheckCircle className="w-3 h-3" />
                            Validé
                          </span>
                        ) : (
                          <span className="status-suspended">
                            <Clock className="w-3 h-3" />
                            En attente
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {record.isValidated && can("payslip:modify") && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Modifier" 
                                onClick={() => {
                                  setSelectedRecordId(record.id);
                                  setShowModificationDialog(true);
                                }}
                                className="text-warning hover:text-warning"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              {getLogsForRecord(record.id).length > 0 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  title="Historique"
                                  onClick={() => {
                                    setSelectedRecordId(record.id);
                                    setShowLogsDialog(true);
                                  }}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {can("payslip:download") && (
                            <Button variant="ghost" size="sm" title="Télécharger" onClick={() => handleDownloadSingle(employee.id)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          {can("payslip:email") && (
                            <Button variant="ghost" size="sm" title="Envoyer par email" onClick={() => handleSendSingleEmail(`${employee.firstName} ${employee.lastName}`)}>
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modification Dialog */}
      {selectedRecord && selectedEmployee && (
        <PayrollModificationDialog
          open={showModificationDialog}
          onOpenChange={setShowModificationDialog}
          employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
          month={selectedMonth}
          currentBreakdown={getBreakdownForRecord(selectedRecord)}
          originalBaseSalary={selectedRecord.modifiedBaseSalary ?? selectedEmployee.baseSalary}
          originalComponents={selectedRecord.modifiedComponents ?? selectedEmployee.salaryComponents}
          originalDeductions={selectedRecord.modifiedDeductions ?? []}
          familyInfo={{
            isMarried: selectedEmployee.maritalStatus === 'married',
            numberOfChildren: selectedEmployee.numberOfChildren || 0,
          }}
          onConfirm={handleModifyPayroll}
        />
      )}

      {/* Logs Dialog */}
      <PayrollLogsDialog
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
        logs={selectedRecordLogs}
        employeeName={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : undefined}
      />
    </MainLayout>
  );
}
