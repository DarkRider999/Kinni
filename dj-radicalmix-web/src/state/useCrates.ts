import { useCallback, useEffect, useState } from "react";
import {
  addCrate,
  deleteCrate,
  listCrates,
  newManualCrate,
  newSmartCrate,
  updateCrate,
  type Crate,
  type CrateRule,
} from "../lib/library";

export function useCrates() {
  const [crates, setCrates] = useState<Crate[]>([]);

  const refresh = useCallback(async () => {
    setCrates(await listCrates());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createManual = useCallback(
    async (name: string) => {
      await addCrate(newManualCrate(name));
      await refresh();
    },
    [refresh],
  );

  const createSmart = useCallback(
    async (name: string, rule: CrateRule) => {
      await addCrate(newSmartCrate(name, rule));
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCrate(id);
      await refresh();
    },
    [refresh],
  );

  const toggleTrack = useCallback((crate: Crate, trackId: string) => {
    // Optimistic: update local state immediately so a controlled checkbox
    // doesn't flicker back to its old value while the IndexedDB write (and a
    // full re-list) is still in flight.
    const has = crate.trackIds.includes(trackId);
    const trackIds = has ? crate.trackIds.filter((id) => id !== trackId) : [...crate.trackIds, trackId];
    const updated = { ...crate, trackIds };
    setCrates((prev) => prev.map((c) => (c.id === crate.id ? updated : c)));
    void updateCrate(updated);
  }, []);

  return { crates, createManual, createSmart, remove, toggleTrack };
}
