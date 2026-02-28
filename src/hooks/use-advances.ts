import { useState, useEffect, useCallback } from "react";
import {
  initDB,
  getAll,
  add,
  update,
  remove,
  getByIndex,
} from "@/lib/local-storage";
import { Advance, getCurrentMonth, calculateAdvanceStatus } from "@/lib/advances";

// Hook for all advances
export function useAdvances() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      const data = await getAll("advances") as Advance[];
      
      // Update status based on current month
      const currentMonth = getCurrentMonth();
      const updatedAdvances = data.map(a => ({
        ...a,
        status: calculateAdvanceStatus(a, currentMonth),
      }));
      
      setAdvances(updatedAdvances);
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

  const addAdvance = async (advance: Advance) => {
    await add("advances", advance);
    await refresh();
  };

  const updateAdvance = async (advance: Advance) => {
    await update("advances", advance);
    await refresh();
  };

  const deleteAdvance = async (id: string) => {
    await remove("advances", id);
    await refresh();
  };

  return { advances, loading, error, refresh, addAdvance, updateAdvance, deleteAdvance };
}

// Hook for employee-specific advances
export function useEmployeeAdvances(employeeId: string) {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      const data = await getByIndex("advances", "employeeId", employeeId) as Advance[];
      
      const currentMonth = getCurrentMonth();
      const updatedAdvances = data.map(a => ({
        ...a,
        status: calculateAdvanceStatus(a, currentMonth),
      }));
      
      setAdvances(updatedAdvances.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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

  return { advances, loading, error, refresh };
}

// Hook to get active deductions for payroll
export function useActiveDeductionsForMonth(month: string) {
  const { advances } = useAdvances();
  
  const deductions = advances
    .filter(a => {
      if (a.status === 'cancelled' || a.status === 'paid') return false;
      if (a.startMonth > month) return false;
      if (a.remainingBalance <= 0) return false;
      return true;
    })
    .map(a => ({
      advanceId: a.id,
      employeeId: a.employeeId,
      type: a.type,
      amount: Math.min(a.monthlyDeduction, a.remainingBalance),
      description: a.description || getAdvanceTypeLabel(a.type),
    }));

  return { deductions };
}

function getAdvanceTypeLabel(type: string): string {
  return type === 'acompte' ? 'Acompte' : 'Avance sur salaire';
}
