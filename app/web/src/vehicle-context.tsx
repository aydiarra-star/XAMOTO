/**
 * XAMOTO — Véhicule actif.
 *
 * Toute l'application (scan, diagnostic, entretien, rapport) travaille sur un
 * véhicule sélectionné. Le choix est mémorisé sur l'appareil pour que
 * l'utilisateur retrouve son contexte même hors ligne.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type ApiVehicle } from './api';
import { useAuth } from './auth';

const ACTIVE_KEY = 'xamoto.activeVehicle';

interface VehicleValue {
  vehicles: ApiVehicle[];
  vehicle: ApiVehicle | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<ApiVehicle[]>;
  select: (vehicleId: string) => void;
  addVehicle: (input: Record<string, unknown>) => Promise<ApiVehicle>;
}

const VehicleContext = createContext<VehicleValue | null>(null);

export function VehicleProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<ApiVehicle[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setVehicles([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ vehicles: ApiVehicle[] }>('/api/vehicles');
      setVehicles(result.vehicles);
      setActiveId((current) => current ?? result.vehicles[0]?.id ?? null);
      return result.vehicles;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement des véhicules impossible.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    try {
      if (activeId) window.localStorage.setItem(ACTIVE_KEY, activeId);
      else window.localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* stockage indisponible */
    }
  }, [activeId]);

  const addVehicle = useCallback(
    async (input: Record<string, unknown>) => {
      const result = await api.post<{ vehicle: ApiVehicle }>('/api/vehicles', input);
      setVehicles((list) => [...list, result.vehicle]);
      setActiveId(result.vehicle.id);
      return result.vehicle;
    },
    [],
  );

  const value = useMemo<VehicleValue>(
    () => ({
      vehicles,
      vehicle: vehicles.find((candidate) => candidate.id === activeId) ?? vehicles[0] ?? null,
      loading,
      error,
      reload,
      select: setActiveId,
      addVehicle,
    }),
    [vehicles, activeId, loading, error, reload, addVehicle],
  );

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicles(): VehicleValue {
  const context = useContext(VehicleContext);
  if (!context) throw new Error('useVehicles doit être utilisé dans VehicleProvider');
  return context;
}
