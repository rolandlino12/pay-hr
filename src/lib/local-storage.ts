import { Employee, Department, PayrollRecord, EmployeeStatus, UserRole } from "./mock-data";
import { EmployeeDocument } from "./file-utils";
import { Advance } from "./advances";
import { PayrollModificationLog } from "./payroll-logs";
import { JournalEntry } from "./accounting-data";

const DB_NAME = "hr_payroll_db";
const DB_VERSION = 5; // Upgraded for accounting entries store

interface StoreConfig {
  employees: Employee;
  departments: Department;
  payrollRecords: PayrollRecord;
  settings: { id: string; value: unknown };
  documents: EmployeeDocument;
  advances: Advance;
  payrollLogs: PayrollModificationLog;
  accountingEntries: JournalEntry;
}

type StoreName = keyof StoreConfig;

let dbInstance: IDBDatabase | null = null;

// Initialize the database
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Employees store
      if (!db.objectStoreNames.contains("employees")) {
        const employeesStore = db.createObjectStore("employees", { keyPath: "id" });
        employeesStore.createIndex("matricule", "matricule", { unique: true });
        employeesStore.createIndex("departmentId", "departmentId", { unique: false });
        employeesStore.createIndex("status", "status", { unique: false });
      }

      // Departments store
      if (!db.objectStoreNames.contains("departments")) {
        db.createObjectStore("departments", { keyPath: "id" });
      }

      // Payroll records store
      if (!db.objectStoreNames.contains("payrollRecords")) {
        const payrollStore = db.createObjectStore("payrollRecords", { keyPath: "id" });
        payrollStore.createIndex("employeeId", "employeeId", { unique: false });
        payrollStore.createIndex("month", "month", { unique: false });
        payrollStore.createIndex("employeeMonth", ["employeeId", "month"], { unique: true });
      }

      // Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }

      // Documents store (new in v2)
      if (!db.objectStoreNames.contains("documents")) {
        const docsStore = db.createObjectStore("documents", { keyPath: "id" });
        docsStore.createIndex("employeeId", "employeeId", { unique: false });
      }

      // Advances store (new in v3)
      if (!db.objectStoreNames.contains("advances")) {
        const advancesStore = db.createObjectStore("advances", { keyPath: "id" });
        advancesStore.createIndex("employeeId", "employeeId", { unique: false });
        advancesStore.createIndex("status", "status", { unique: false });
        advancesStore.createIndex("startMonth", "startMonth", { unique: false });
      }

      // Payroll modification logs store (new in v4)
      if (!db.objectStoreNames.contains("payrollLogs")) {
        const logsStore = db.createObjectStore("payrollLogs", { keyPath: "id" });
        logsStore.createIndex("employeeId", "employeeId", { unique: false });
        logsStore.createIndex("payrollRecordId", "payrollRecordId", { unique: false });
        logsStore.createIndex("month", "month", { unique: false });
      }

      // Accounting entries store (new in v5)
      if (!db.objectStoreNames.contains("accountingEntries")) {
        const accountingStore = db.createObjectStore("accountingEntries", { keyPath: "id" });
        accountingStore.createIndex("date", "date", { unique: false });
        accountingStore.createIndex("status", "status", { unique: false });
      }
    };
  });
}

// Generic CRUD operations
async function getStore(storeName: StoreName, mode: IDBTransactionMode = "readonly"): Promise<IDBObjectStore> {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function getAll<T extends StoreName>(storeName: T): Promise<StoreConfig[T][]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getById<T extends StoreName>(storeName: T, id: string): Promise<StoreConfig[T] | undefined> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function add<T extends StoreName>(storeName: T, item: StoreConfig[T]): Promise<string> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result as string);
    request.onerror = () => reject(request.error);
  });
}

export async function update<T extends StoreName>(storeName: T, item: StoreConfig[T]): Promise<string> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result as string);
    request.onerror = () => reject(request.error);
  });
}

export async function remove<T extends StoreName>(storeName: T, id: string): Promise<void> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulkAdd<T extends StoreName>(storeName: T, items: StoreConfig[T][]): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    
    items.forEach(item => store.put(item));
  });
}

export async function clearStore<T extends StoreName>(storeName: T): Promise<void> {
  const store = await getStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Query helpers
export async function getByIndex<T extends StoreName>(
  storeName: T,
  indexName: string,
  value: IDBValidKey | IDBKeyRange
): Promise<StoreConfig[T][]> {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Check if database has been seeded
export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const setting = await getById("settings", "db_seeded");
    return setting?.value === true;
  } catch {
    return false;
  }
}

export async function markDatabaseSeeded(): Promise<void> {
  await update("settings", { id: "db_seeded", value: true });
}

// Export/Import for backup
export async function exportAllData(): Promise<{
  employees: Employee[];
  departments: Department[];
  payrollRecords: PayrollRecord[];
  advances: Advance[];
  accountingEntries: JournalEntry[];
  payrollLogs: PayrollModificationLog[];
}> {
  const [employees, departments, payrollRecords, advances, accountingEntries, payrollLogs] = await Promise.all([
    getAll("employees"),
    getAll("departments"),
    getAll("payrollRecords"),
    getAll("advances"),
    getAll("accountingEntries"),
    getAll("payrollLogs"),
  ]);
  return { employees, departments, payrollRecords, advances, accountingEntries, payrollLogs };
}

export async function importAllData(data: {
  employees?: Employee[];
  departments?: Department[];
  payrollRecords?: PayrollRecord[];
  advances?: Advance[];
  accountingEntries?: JournalEntry[];
  payrollLogs?: PayrollModificationLog[];
}): Promise<void> {
  if (data.departments) await bulkAdd("departments", data.departments);
  if (data.employees) await bulkAdd("employees", data.employees);
  if (data.payrollRecords) await bulkAdd("payrollRecords", data.payrollRecords);
  if (data.advances) await bulkAdd("advances", data.advances);
  if (data.accountingEntries) await bulkAdd("accountingEntries", data.accountingEntries);
  if (data.payrollLogs) await bulkAdd("payrollLogs", data.payrollLogs);
}
