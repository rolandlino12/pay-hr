import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  FileText,
  Calculator,
  BarChart3,
  Plus,
  Check,
  Search,
  Download,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { usePayrollRecords } from "@/hooks/use-local-data";
import { useAccountingEntries } from "@/hooks/use-accounting-data";
import {
  syscohadaAccounts,
  accountCategories,
  generatePayrollJournalEntries,
  calculateLedger,
  calculateBalance,
  JournalEntry,
  Account,
} from "@/lib/accounting-data";
import { exportToCSV } from "@/lib/file-utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F";
};

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("chart");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  
  const { can } = useUser();
  const { records } = usePayrollRecords();
  const { entries, addEntry, updateEntry, loading } = useAccountingEntries();

  // Filter accounts for chart view
  const filteredAccounts = useMemo(() => {
    return syscohadaAccounts.filter((account) => {
      const matchesSearch =
        account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "Tous" || account.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, categoryFilter]);

  // Calculate ledger for selected account
  const ledgerEntries = useMemo(() => {
    if (!selectedAccount) return [];
    return calculateLedger(selectedAccount.code, entries);
  }, [selectedAccount, entries]);

  // Calculate balance
  const balanceEntries = useMemo(() => {
    return calculateBalance(entries);
  }, [entries]);

  // Get available months from payroll records
  const availableMonths = useMemo(() => {
    const months = new Set(records.map((r) => r.month));
    return Array.from(months).sort().reverse();
  }, [records]);

  // Generate payroll journal entry
  const handleGeneratePayrollEntry = async () => {
    const monthRecords = records.filter((r) => r.month === selectedMonth && r.isValidated);
    
    if (monthRecords.length === 0) {
      toast.error("Aucun bulletin validé pour ce mois");
      return;
    }

    const existingEntry = entries.find((e) => e.reference === `PAIE-${selectedMonth}`);
    if (existingEntry) {
      toast.error("Une écriture existe déjà pour ce mois");
      return;
    }

    const totals = monthRecords.reduce(
      (acc, r) => ({
        totalGross: acc.totalGross + r.grossEarnings,
        totalNet: acc.totalNet + r.netSalary,
        cnssEmployee: acc.cnssEmployee + r.cnssEmployee,
        cnssEmployer: acc.cnssEmployer + r.cnssEmployer,
        amuEmployee: acc.amuEmployee + r.amuEmployee,
        amuEmployer: acc.amuEmployer + r.amuEmployer,
        irpp: acc.irpp + r.irpp,
        totalAllowances: 0, // Will be calculated from gross - base if needed
      }),
      {
        totalGross: 0,
        totalNet: 0,
        cnssEmployee: 0,
        cnssEmployer: 0,
        amuEmployee: 0,
        amuEmployer: 0,
        irpp: 0,
        totalAllowances: 0,
      }
    );

    try {
      const entry = generatePayrollJournalEntries(selectedMonth, totals);
      await addEntry(entry);
      setShowGenerateDialog(false);
      toast.success("Écriture de paie générée");
    } catch (err) {
      toast.error("Erreur lors de la génération de l'écriture");
    }
  };

  // Validate entry
  const handleValidateEntry = async (entry: JournalEntry) => {
    try {
      await updateEntry({
        ...entry,
        status: "validated",
        validatedAt: new Date().toISOString(),
      });
      toast.success("Écriture validée");
    } catch (err) {
      toast.error("Erreur lors de la validation");
    }
  };

  // Export functions
  const exportChartOfAccounts = () => {
    const data = syscohadaAccounts.map((a) => ({
      Code: a.code,
      Libellé: a.label,
      Type: a.type,
      Catégorie: a.category,
    }));
    exportToCSV(data, `plan-comptable`);
  };

  const exportJournal = () => {
    const data = entries.flatMap((e) =>
      e.lines.map((l) => ({
        Date: e.date,
        Référence: e.reference,
        Compte: l.accountCode,
        Libellé: l.label || e.description,
        Débit: l.debit,
        Crédit: l.credit,
        Statut: e.status === "validated" ? "Validé" : "Brouillon",
      }))
    );
    exportToCSV(data, `journal-comptable`);
  };

  const exportLedger = () => {
    if (!selectedAccount) return;
    const data = ledgerEntries.map((l) => ({
      Date: l.date,
      Référence: l.reference,
      Libellé: l.description,
      Débit: l.debit,
      Crédit: l.credit,
      Solde: l.balance,
    }));
    exportToCSV(data, `grand-livre-${selectedAccount.code}`);
  };

  const exportBalance = () => {
    const data = balanceEntries.map((b) => ({
      Compte: b.accountCode,
      Libellé: b.accountLabel,
      "Mouvement Débit": b.debitMovement,
      "Mouvement Crédit": b.creditMovement,
      "Solde Débit": b.debitBalance,
      "Solde Crédit": b.creditBalance,
    }));
    exportToCSV(data, `balance-generale`);
  };

  // Calculate totals for balance
  const balanceTotals = useMemo(() => {
    return balanceEntries.reduce(
      (acc, b) => ({
        debitMovement: acc.debitMovement + b.debitMovement,
        creditMovement: acc.creditMovement + b.creditMovement,
        debitBalance: acc.debitBalance + b.debitBalance,
        creditBalance: acc.creditBalance + b.creditBalance,
      }),
      { debitMovement: 0, creditMovement: 0, debitBalance: 0, creditBalance: 0 }
    );
  }, [balanceEntries]);

  return (
    <MainLayout>
      <PageHeader
        title="Comptabilité"
        description="Gestion comptable et écritures de paie"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="chart" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Plan comptable
          </TabsTrigger>
          <TabsTrigger value="journal" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Journal
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Grand livre
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Balance
          </TabsTrigger>
        </TabsList>

        {/* Plan Comptable */}
        <TabsContent value="chart">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Plan Comptable SYSCOHADA</CardTitle>
              <Button variant="outline" size="sm" onClick={exportChartOfAccounts}>
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par code ou libellé..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="w-40">Catégorie</TableHead>
                      <TableHead className="w-32">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow
                        key={account.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedAccount(account);
                          setActiveTab("ledger");
                        }}
                      >
                        <TableCell className="font-mono font-medium">
                          {account.code}
                        </TableCell>
                        <TableCell>{account.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{account.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              account.type === "expense"
                                ? "destructive"
                                : account.type === "asset"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {account.type === "asset"
                              ? "Actif"
                              : account.type === "liability"
                              ? "Passif"
                              : account.type === "expense"
                              ? "Charge"
                              : account.type === "revenue"
                              ? "Produit"
                              : "Capitaux"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Journal des écritures */}
        <TabsContent value="journal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Journal des écritures</CardTitle>
              <div className="flex gap-2">
                {can("accounting:export") && (
                  <Button variant="outline" size="sm" onClick={exportJournal}>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </Button>
                )}
                {can("accounting:generate") && (
                  <Button size="sm" onClick={() => setShowGenerateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Générer écriture de paie
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune écriture comptable</p>
                  <p className="text-sm mt-1">
                    Générez une écriture de paie à partir des bulletins validés
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <Card key={entry.id} className="overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{entry.reference}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(entry.date), "dd MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                          <Badge
                            variant={entry.status === "validated" ? "default" : "secondary"}
                          >
                            {entry.status === "validated" ? "Validé" : "Brouillon"}
                          </Badge>
                        </div>
                        {entry.status === "draft" && can("accounting:validate") && (
                          <Button
                            size="sm"
                            onClick={() => handleValidateEntry(entry)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Valider
                          </Button>
                        )}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Compte</TableHead>
                            <TableHead>Libellé</TableHead>
                            <TableHead className="text-right w-32">Débit</TableHead>
                            <TableHead className="text-right w-32">Crédit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.lines.map((line, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">
                                {line.accountCode}
                              </TableCell>
                              <TableCell>
                                {line.label || line.accountLabel}
                              </TableCell>
                              <TableCell className="text-right">
                                {line.debit > 0 ? formatCurrency(line.debit) : ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {line.credit > 0 ? formatCurrency(line.credit) : ""}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30 font-medium">
                            <TableCell colSpan={2} className="text-right">
                              Total
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                entry.lines.reduce((sum, l) => sum + l.debit, 0)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                entry.lines.reduce((sum, l) => sum + l.credit, 0)
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grand livre */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Grand livre
                {selectedAccount && (
                  <span className="text-muted-foreground font-normal ml-2">
                    - {selectedAccount.code} {selectedAccount.label}
                  </span>
                )}
              </CardTitle>
              {selectedAccount && ledgerEntries.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportLedger}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Select
                  value={selectedAccount?.code || ""}
                  onValueChange={(code) => {
                    const account = syscohadaAccounts.find((a) => a.code === code);
                    setSelectedAccount(account || null);
                  }}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Sélectionner un compte..." />
                  </SelectTrigger>
                  <SelectContent>
                    {syscohadaAccounts.map((account) => (
                      <SelectItem key={account.code} value={account.code}>
                        {account.code} - {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedAccount ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Sélectionnez un compte pour voir le grand livre</p>
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun mouvement validé pour ce compte</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Date</TableHead>
                        <TableHead className="w-32">Référence</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead className="text-right w-32">Débit</TableHead>
                        <TableHead className="text-right w-32">Crédit</TableHead>
                        <TableHead className="text-right w-36">Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {format(new Date(entry.date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {entry.reference}
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell className="text-right">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              entry.balance >= 0 ? "text-foreground" : "text-destructive"
                            }`}
                          >
                            {formatCurrency(Math.abs(entry.balance))}
                            {entry.balance < 0 ? " (Cr)" : " (Db)"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance générale */}
        <TabsContent value="balance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Balance générale</CardTitle>
              {balanceEntries.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportBalance}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {balanceEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune écriture validée</p>
                  <p className="text-sm mt-1">
                    Validez des écritures dans le journal pour voir la balance
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Compte</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead className="text-right w-32">Mvt Débit</TableHead>
                        <TableHead className="text-right w-32">Mvt Crédit</TableHead>
                        <TableHead className="text-right w-32">Solde Débit</TableHead>
                        <TableHead className="text-right w-32">Solde Crédit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceEntries.map((entry) => (
                        <TableRow
                          key={entry.accountCode}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            const account = syscohadaAccounts.find(
                              (a) => a.code === entry.accountCode
                            );
                            if (account) {
                              setSelectedAccount(account);
                              setActiveTab("ledger");
                            }
                          }}
                        >
                          <TableCell className="font-mono font-medium">
                            {entry.accountCode}
                          </TableCell>
                          <TableCell>{entry.accountLabel}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(entry.debitMovement)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(entry.creditMovement)}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.debitBalance > 0
                              ? formatCurrency(entry.debitBalance)
                              : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.creditBalance > 0
                              ? formatCurrency(entry.creditBalance)
                              : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceTotals.debitMovement)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceTotals.creditMovement)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceTotals.debitBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceTotals.creditBalance)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Payroll Entry Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer une écriture de paie</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Mois de paie
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un mois" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    {format(new Date(month + "-01"), "MMMM yyyy", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              L'écriture sera générée à partir des bulletins de paie validés pour ce mois.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleGeneratePayrollEntry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
