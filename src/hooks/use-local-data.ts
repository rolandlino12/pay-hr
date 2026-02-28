import { useState, useEffect, useCallback } from "react";
import {
  initDB,
  getAll,
  getById,
  add,
  update,
  remove,
  bulkAdd,
  getByIndex,
  isDatabaseSeeded,
  markDatabaseSeeded,
} from "@/lib/local-storage";
import {
  Employee,
  Department,
  PayrollRecord,
  mockEmployees,
  mockDepartments,
  mockPayrollRecords,
} from "@/lib/mock-data";
import { EmployeeDocument } from "@/lib/file-utils";
import { dataEvents, DATA_EVENTS } from "@/lib/data-events";
import { calculatePayroll } from "@/lib/payroll-engine";

// Global seeding lock to prevent race conditions
let seedingPromise: Promise<void> | null = null;

// Initialize and seed database with mock data if empty
async function seedDatabaseIfNeeded(): Promise<void> {
  // If seeding is already in progress, wait for it
  if (seedingPromise) {
    return seedingPromise;
  }

  const seeded = await isDatabaseSeeded();
  if (seeded) {
    return;
  }

  // Create a single seeding promise that all callers will wait on
  seedingPromise = (async () => {
    try {
      // Double-check after acquiring the "lock"
      const stillNotSeeded = !(await isDatabaseSeeded());
      if (stillNotSeeded) {
        console.log("Seeding database with initial data...");
        await bulkAdd("departments", mockDepartments);
        await bulkAdd("employees", mockEmployees);
        await bulkAdd("payrollRecords", mockPayrollRecords);
        await markDatabaseSeeded();
        console.log("Database seeded successfully");
      }
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

// Hook for employees
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      await seedDatabaseIfNeeded();
      const data = await getAll("employees");
      setEmployees(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Subscribe to employee changes from other components
    const unsubscribe = dataEvents.subscribe(DATA_EVENTS.EMPLOYEES_CHANGED, refresh);
    return unsubscribe;
  }, [refresh]);

  const addEmployee = async (employee: Employee) => {
    await add("employees", employee);
    await refresh();
    dataEvents.emit(DATA_EVENTS.EMPLOYEES_CHANGED);
  };

  const updateEmployee = async (employee: Employee) => {
    await update("employees", employee);
    await refresh();
    dataEvents.emit(DATA_EVENTS.EMPLOYEES_CHANGED);
  };

  const deleteEmployee = async (id: string) => {
    await remove("employees", id);
    await refresh();
    dataEvents.emit(DATA_EVENTS.EMPLOYEES_CHANGED);
  };

  return { employees, loading, error, refresh, addEmployee, updateEmployee, deleteEmployee };
}

// Hook for single employee
export function useEmployee(id: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      await seedDatabaseIfNeeded();
      const data = await getById("employees", id);
      setEmployee(data || null);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateEmployee = async (employee: Employee) => {
    await update("employees", employee);
    await refresh();
  };

  return { employee, loading, error, refresh, updateEmployee };
}

// Hook for departments
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      await seedDatabaseIfNeeded();
      const data = await getAll("departments");
      setDepartments(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addDepartment = async (department: Department) => {
    await add("departments", department);
    await refresh();
  };

  const updateDepartment = async (department: Department) => {
    await update("departments", department);
    await refresh();
  };

  const deleteDepartment = async (id: string) => {
    await remove("departments", id);
    await refresh();
  };

  return { departments, loading, error, refresh, addDepartment, updateDepartment, deleteDepartment };
}

// Hook for payroll records
export function usePayrollRecords(month?: string) {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      await seedDatabaseIfNeeded();
      const data = month
        ? await getByIndex("payrollRecords", "month", month)
        : await getAll("payrollRecords");
      setRecords(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRecord = async (record: PayrollRecord) => {
    await add("payrollRecords", record);
    await refresh();
  };

  const updateRecord = async (record: PayrollRecord) => {
    await update("payrollRecords", record);
    await refresh();
  };

  return { records, loading, error, refresh, addRecord, updateRecord };
}

// Hook for employee payroll history
export function useEmployeePayroll(employeeId: string) {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      await seedDatabaseIfNeeded();
      const data = await getByIndex("payrollRecords", "employeeId", employeeId);
      setRecords(data.sort((a, b) => b.month.localeCompare(a.month)));
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, error, refresh };
}

// Summary statistics hook
export function usePayrollSummary() {
  const { employees } = useEmployees();
  const { departments } = useDepartments();

  const activeEmployees = employees.filter(e => e.status === "active");
  
  // Calculer dynamiquement les totaux à partir des employés actifs
  let totalGross = 0;
  let totalNet = 0;
  let totalCNSS = 0;
  let totalAMU = 0;
  let totalIRPP = 0;
  let totalCost = 0;

  activeEmployees.forEach(emp => {
    const breakdown = calculatePayroll({
      baseSalary: emp.baseSalary,
      components: emp.salaryComponents || [],
      deductions: [],
      familyInfo: {
        isMarried: emp.maritalStatus === 'married',
        numberOfChildren: emp.numberOfChildren || 0,
      }
    });

    totalGross += breakdown.grossEarnings;
    totalNet += breakdown.netSalary;
    totalCNSS += breakdown.cnssEmployee + breakdown.cnssEmployer;
    totalAMU += breakdown.amuEmployee + breakdown.amuEmployer;
    totalIRPP += breakdown.monthlyIRPP;
    totalCost += breakdown.totalEmployerCost;
  });

  return {
    employeeCount: {
      total: employees.length,
      active: activeEmployees.length,
      suspended: employees.filter(e => e.status === "suspended").length,
      left: employees.filter(e => e.status === "left").length,
      onLeave: employees.filter(e => e.status === "on_leave").length,
    },
    currentMonth: {
      totalGross,
      totalNet,
      totalCNSS,
      totalAMU,
      totalIRPP,
      totalCost,
    },
    departmentCount: departments.length,
  };
}

// Hook for employee documents
export function useEmployeeDocuments(employeeId: string) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      const data = await getByIndex("documents", "employeeId", employeeId);
      setDocuments(data as EmployeeDocument[]);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) {
      refresh();
    }
  }, [employeeId, refresh]);

  const addDocument = async (document: EmployeeDocument) => {
    await add("documents", document);
    await refresh();
  };

  const deleteDocument = async (id: string) => {
    await remove("documents", id);
    await refresh();
  };

  return { documents, loading, error, refresh, addDocument, deleteDocument };
}
