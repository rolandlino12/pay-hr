import { useState, useEffect, useCallback } from "react";
import { JournalEntry } from "@/lib/accounting-data";
import { initDB, getAll, add, update, remove } from "@/lib/local-storage";

// Migrated from localStorage to IndexedDB for persistent storage
export function useAccountingEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      await initDB();
      const data = await getAll("accountingEntries");
      // Sort by date descending
      setEntries(data.sort((a, b) => b.date.localeCompare(a.date)));
      setError(null);
    } catch (err) {
      console.error("Failed to load accounting entries:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const addEntry = async (entry: JournalEntry) => {
    try {
      await add("accountingEntries", entry);
      await loadEntries();
    } catch (err) {
      console.error("Failed to add accounting entry:", err);
      throw err;
    }
  };

  const updateEntry = async (entry: JournalEntry) => {
    try {
      await update("accountingEntries", entry);
      await loadEntries();
    } catch (err) {
      console.error("Failed to update accounting entry:", err);
      throw err;
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await remove("accountingEntries", id);
      await loadEntries();
    } catch (err) {
      console.error("Failed to delete accounting entry:", err);
      throw err;
    }
  };

  return {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh: loadEntries,
  };
}
