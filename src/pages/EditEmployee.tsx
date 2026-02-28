import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmployee, useDepartments } from "@/hooks/use-local-data";
import { useToast } from "@/hooks/use-toast";
import { EmployeeStatus } from "@/lib/mock-data";
import { SalaryComponent } from "@/lib/payroll-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";

const INDEMNITY_TYPES = [
  { value: "transport", label: "Indemnité de transport" },
  { value: "logement", label: "Indemnité de logement" },
  { value: "responsabilite", label: "Prime de responsabilité" },
  { value: "anciennete", label: "Prime d'ancienneté" },
  { value: "rendement", label: "Prime de rendement" },
  { value: "risque", label: "Prime de risque" },
  { value: "panier", label: "Indemnité de panier" },
  { value: "representation", label: "Frais de représentation" },
  { value: "deplacement", label: "Indemnité de déplacement" },
  { value: "bonus", label: "Bonus exceptionnel" },
  { value: "autre", label: "Autre" },
];

interface IndemnityEntry {
  id: string;
  type: string;
  customName: string;
  amount: string;
  isTaxable: boolean;
  includedInCNSS: boolean;
  includedInAMU: boolean;
  isRecurring: boolean;
}

export default function EditEmployee() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { employee, loading, updateEmployee } = useEmployee(id || "");
  const { departments } = useDepartments();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    hireDate: "",
    endDate: "",
    status: "active" as EmployeeStatus,
    departmentId: "",
    position: "",
    baseSalary: "",
    maritalStatus: "single" as "single" | "married" | "divorced" | "widowed",
    numberOfChildren: "0",
    cnssNumber: "",
    amuNumber: "",
    nif: "",
    bankName: "",
    bankAccountNumber: "",
    address: "",
    emergencyContact: "",
  });

  const [indemnities, setIndemnities] = useState<IndemnityEntry[]>([]);

  // Initialize form with employee data
  useEffect(() => {
    if (employee && !isInitialized) {
      setFormData({
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        phone: employee.phone || "",
        dateOfBirth: employee.dateOfBirth || "",
        hireDate: employee.hireDate || "",
        endDate: employee.endDate || "",
        status: employee.status,
        departmentId: employee.departmentId || "",
        position: employee.position || "",
        baseSalary: employee.baseSalary?.toString() || "",
        maritalStatus: employee.maritalStatus || "single",
        numberOfChildren: (employee.numberOfChildren ?? 0).toString(),
        cnssNumber: employee.cnssNumber || "",
        amuNumber: employee.amuNumber || "",
        nif: employee.nif || "",
        bankName: employee.bankName || "",
        bankAccountNumber: employee.bankAccountNumber || "",
        address: employee.address || "",
        emergencyContact: employee.emergencyContact || "",
      });

      // Convert salary components to indemnities
      const existingIndemnities: IndemnityEntry[] = (employee.salaryComponents || []).map((sc) => {
        const matchedType = INDEMNITY_TYPES.find((t) => t.label === sc.name);
        return {
          id: sc.id,
          type: matchedType?.value || "autre",
          customName: matchedType ? "" : sc.name,
          amount: sc.amount.toString(),
          isTaxable: sc.isTaxable,
          includedInCNSS: sc.includedInCNSS,
          includedInAMU: sc.includedInAMU,
          isRecurring: sc.isRecurring,
        };
      });
      setIndemnities(existingIndemnities);
      setIsInitialized(true);
    }
  }, [employee, isInitialized]);

  const addIndemnity = () => {
    setIndemnities((prev) => [
      ...prev,
      {
        id: `ind-${Date.now()}`,
        type: "",
        customName: "",
        amount: "",
        isTaxable: true,
        includedInCNSS: true,
        includedInAMU: true,
        isRecurring: true,
      },
    ]);
  };

  const removeIndemnity = (indId: string) => {
    setIndemnities((prev) => prev.filter((ind) => ind.id !== indId));
  };

  const updateIndemnity = (indId: string, field: keyof IndemnityEntry, value: string | boolean) => {
    setIndemnities((prev) =>
      prev.map((ind) => (ind.id === indId ? { ...ind, [field]: value } : ind))
    );
  };

  const getIndemnityName = (ind: IndemnityEntry): string => {
    if (ind.type === "autre" && ind.customName.trim()) {
      return ind.customName.trim();
    }
    const found = INDEMNITY_TYPES.find((t) => t.value === ind.type);
    return found?.label || "Indemnité";
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trim values before validation
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPosition = formData.position.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !formData.departmentId || !trimmedPosition || !formData.baseSalary) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez remplir tous les champs obligatoires (Prénom, Nom, Email, Département, Poste, Salaire).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const salaryComponents: SalaryComponent[] = indemnities
        .filter((ind) => ind.type && ind.amount)
        .map((ind) => ({
          id: ind.id,
          name: getIndemnityName(ind),
          amount: parseInt(ind.amount) || 0,
          isTaxable: ind.isTaxable,
          includedInCNSS: ind.includedInCNSS,
          includedInAMU: ind.includedInAMU,
          isRecurring: ind.isRecurring,
        }));

      await updateEmployee({
        ...employee!,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim().toUpperCase(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        dateOfBirth: formData.dateOfBirth,
        hireDate: formData.hireDate,
        endDate: formData.endDate || undefined,
        status: formData.status,
        departmentId: formData.departmentId,
        position: formData.position.trim(),
        baseSalary: parseInt(formData.baseSalary) || 0,
        salaryComponents,
        maritalStatus: formData.maritalStatus,
        numberOfChildren: parseInt(formData.numberOfChildren) || 0,
        cnssNumber: formData.cnssNumber.trim() || undefined,
        amuNumber: formData.amuNumber.trim() || undefined,
        nif: formData.nif.trim() || undefined,
        bankName: formData.bankName.trim() || undefined,
        bankAccountNumber: formData.bankAccountNumber.trim() || undefined,
        address: formData.address.trim() || undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
      });

      toast({
        title: "Employé modifié",
        description: `${formData.firstName} ${formData.lastName} a été mis à jour avec succès.`,
      });

      navigate(`/employees/${id}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la modification.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!employee) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Employé non trouvé.</p>
          <Button variant="outline" onClick={() => navigate("/employees")} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Modifier l'employé"
        description={`${employee.firstName} ${employee.lastName} - ${employee.matricule}`}
        actions={
          <Button variant="outline" onClick={() => navigate(`/employees/${id}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations personnelles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date de naissance</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Informations professionnelles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations professionnelles</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Département *</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => handleChange("departmentId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un département" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Poste *</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => handleChange("position", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Date d'embauche *</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={(e) => handleChange("hireDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Date de départ</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange("endDate", e.target.value)}
                min={formData.hireDate}
              />
              <p className="text-xs text-muted-foreground">
                Remplir si l'employé a quitté l'entreprise
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="on_leave">En congé</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="left">Parti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseSalary">Salaire de base (FCFA) *</Label>
              <Input
                id="baseSalary"
                type="number"
                value={formData.baseSalary}
                onChange={(e) => handleChange("baseSalary", e.target.value)}
                min="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Contact d'urgence</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => handleChange("emergencyContact", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maritalStatus">Situation matrimoniale</Label>
              <Select
                value={formData.maritalStatus}
                onValueChange={(value) => handleChange("maritalStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié(e)</SelectItem>
                  <SelectItem value="divorced">Divorcé(e)</SelectItem>
                  <SelectItem value="widowed">Veuf/Veuve</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfChildren">Nombre d'enfants à charge</Label>
              <Select
                value={formData.numberOfChildren}
                onValueChange={(value) => handleChange("numberOfChildren", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} {n === 1 ? "enfant" : "enfants"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum 6 enfants pour les déductions IRPP (LOFI 2023)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Indemnités et primes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Indemnités et primes</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addIndemnity}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {indemnities.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Aucune indemnité. Cliquez sur "Ajouter" pour en créer une.
              </p>
            ) : (
              indemnities.map((ind, index) => (
                <div key={ind.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Indemnité #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIndemnity(ind.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Type d'indemnité *</Label>
                      <Select
                        value={ind.type}
                        onValueChange={(value) => updateIndemnity(ind.id, "type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDEMNITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {ind.type === "autre" && (
                      <div className="space-y-2">
                        <Label>Nom personnalisé *</Label>
                        <Input
                          value={ind.customName}
                          onChange={(e) => updateIndemnity(ind.id, "customName", e.target.value)}
                          placeholder="Ex: Prime de performance"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Montant (FCFA) *</Label>
                      <Input
                        type="number"
                        value={ind.amount}
                        onChange={(e) => updateIndemnity(ind.id, "amount", e.target.value)}
                        placeholder="50000"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`recurring-${ind.id}`}
                        checked={ind.isRecurring}
                        onCheckedChange={(checked) => updateIndemnity(ind.id, "isRecurring", !!checked)}
                      />
                      <Label htmlFor={`recurring-${ind.id}`} className="text-sm font-normal cursor-pointer">
                        Récurrent (mensuel)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`taxable-${ind.id}`}
                        checked={ind.isTaxable}
                        onCheckedChange={(checked) => updateIndemnity(ind.id, "isTaxable", !!checked)}
                      />
                      <Label htmlFor={`taxable-${ind.id}`} className="text-sm font-normal cursor-pointer">
                        Imposable (IRPP)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`cnss-${ind.id}`}
                        checked={ind.includedInCNSS}
                        onCheckedChange={(checked) => updateIndemnity(ind.id, "includedInCNSS", !!checked)}
                      />
                      <Label htmlFor={`cnss-${ind.id}`} className="text-sm font-normal cursor-pointer">
                        Soumis CNSS
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`amu-${ind.id}`}
                        checked={ind.includedInAMU}
                        onCheckedChange={(checked) => updateIndemnity(ind.id, "includedInAMU", !!checked)}
                      />
                      <Label htmlFor={`amu-${ind.id}`} className="text-sm font-normal cursor-pointer">
                        Soumis AMU
                      </Label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Informations bancaires et sociales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations bancaires et sociales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnssNumber">N° CNSS</Label>
              <Input
                id="cnssNumber"
                value={formData.cnssNumber}
                onChange={(e) => handleChange("cnssNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amuNumber">N° AMU</Label>
              <Input
                id="amuNumber"
                value={formData.amuNumber}
                onChange={(e) => handleChange("amuNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input
                id="nif"
                value={formData.nif}
                onChange={(e) => handleChange("nif", e.target.value)}
                placeholder="Numéro d'Identification Fiscale"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Banque</Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountNumber">N° compte bancaire</Label>
              <Input
                id="bankAccountNumber"
                value={formData.bankAccountNumber}
                onChange={(e) => handleChange("bankAccountNumber", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/employees/${id}`)}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      </form>
    </MainLayout>
  );
}
