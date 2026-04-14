
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cktbrxwgqrtgvrbxuqzs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NHVjMcerDg4-2vzNpK-r9A_VjtgB5GQ';

// Cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helpers para LocalStorage
 */
const saveLocal = (key: string, data: any) => {
    try {
        const stringified = JSON.stringify(data);
        localStorage.setItem(`nexus_local_${key}`, stringified);
        console.log(`[NexusLocal] Salvo: ${key} (${stringified.length} bytes)`);
    } catch (e) {
        console.error("Erro ao salvar localmente:", e);
    }
};

const loadLocal = (key: string) => {
    try {
        const data = localStorage.getItem(`nexus_local_${key}`);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Erro ao carregar local:", e);
        return null;
    }
};

/**
 * Sincroniza dados com o Supabase com fallback silencioso para erro de cota
 */
export const syncToSupabase = async (tableName: string, data: any[]) => {
  // Salva localmente primeiro (Garante que o usuário não perca nada)
  saveLocal(tableName, data);

  try {
    if (!data || !Array.isArray(data)) return { success: false, error: 'Dados inválidos' };
    if (data.length === 0) return { success: true };

    // Limpeza de dados para o Supabase
    const cleanData = data.map(item => {
      const cleaned: any = {};
      Object.keys(item).forEach(key => {
        const val = item[key];
        if (typeof val !== 'function' && val !== undefined && !key.startsWith('_')) {
          cleaned[key] = val;
        }
      });
      return cleaned;
    });

    const { error } = await supabase.from(tableName).upsert(cleanData, { onConflict: 'id' });
    
    if (error) {
      console.warn(`[Supabase] Erro de sincronização em ${tableName}:`, error.message);
      // Se for erro de cota, retornamos sucesso "parcial" (salvo localmente)
      if (error.message.includes('quota') || error.message.includes('limit')) {
          return { success: true, warning: 'Limite do Supabase atingido. Dados salvos apenas localmente.' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error(`[Supabase] Falha crítica em ${tableName}:`, err);
    return { success: true, warning: 'Falha na rede. Dados salvos localmente.' };
  }
};

/**
 * Busca dados priorizando Supabase, mas mesclando com LocalStorage para evitar perda de dados locais
 */
export const fetchFromSupabase = async <T>(tableName: string): Promise<T[] | null> => {
  const localData = loadLocal(tableName) || [];
  
  try {
    const { data: cloudData, error } = await supabase.from(tableName).select('*');
    
    if (error) {
      console.warn(`[Supabase] Erro ao buscar ${tableName}, usando backup local.`);
      return localData as T[];
    }
    
    // Estratégia de Mesclagem (Local-First):
    // Mantemos os dados da nuvem como base, mas preservamos itens locais que ainda não subiram
    const cloudItems = (cloudData as any[]) || [];
    const cloudIds = new Set(cloudItems.map(item => item.id));
    
    // Filtra itens que existem apenas localmente
    const localOnlyItems = Array.isArray(localData) 
        ? localData.filter((item: any) => item && item.id && !cloudIds.has(item.id))
        : [];
    
    const mergedData = [...cloudItems, ...localOnlyItems];
    
    // Atualiza o backup local com a versão mesclada
    if (mergedData.length > 0) {
        saveLocal(tableName, mergedData);
    }

    return mergedData as T[];
  } catch (err) {
    console.error(`[Supabase] Falha na busca em ${tableName}, usando backup local.`);
    return localData as T[];
  }
};

/**
 * Hook Principal de Dados (Híbrido: Local + Cloud)
 */
export function useSupabaseData<T>(
    tableName: string, 
    initialValue: T
): [T, (value: T | ((val: T) => T)) => Promise<{ success: boolean; error?: string; warning?: string }>, () => Promise<void>, boolean, string | null] {
    
    // Tenta carregar do local imediatamente para evitar tela branca
    const [storedValue, setStoredValue] = useState<T>(() => {
        const local = loadLocal(tableName);
        return local || initialValue;
    });
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastValueRef = useRef<T>(storedValue);

    useEffect(() => {
        lastValueRef.current = storedValue;
    }, [storedValue]);

    // Listener para sincronização entre instâncias do mesmo hook (mesma janela)
    useEffect(() => {
        const handleSync = (e: any) => {
            if (e.detail && e.detail.tableName === tableName && e.detail.data !== lastValueRef.current) {
                setStoredValue(e.detail.data);
                lastValueRef.current = e.detail.data;
            }
        };
        window.addEventListener('nexus_supabase_sync', handleSync);
        return () => window.removeEventListener('nexus_supabase_sync', handleSync);
    }, [tableName]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFromSupabase<any>(tableName);
            if (data) {
                setStoredValue(data as unknown as T);
                lastValueRef.current = data as unknown as T;
            }
        } finally {
            setLoading(false);
        }
    }, [tableName]);

    useEffect(() => {
        load();
    }, [load]);

    const setValue = async (value: T | ((val: T) => T)): Promise<{ success: boolean; error?: string; warning?: string }> => {
        const nextValue = value instanceof Function ? value(lastValueRef.current) : value;
        
        // Atualiza estado e ref IMEDIATAMENTE (UI rápida)
        setStoredValue(nextValue);
        lastValueRef.current = nextValue;

        // Notifica outras instâncias do hook na mesma página
        window.dispatchEvent(new CustomEvent('nexus_supabase_sync', { detail: { tableName, data: nextValue } }));

        if (Array.isArray(nextValue)) {
            const result = await syncToSupabase(tableName, nextValue);
            if (!result.success) {
                setError(result.error || 'Erro ao sincronizar');
            } else {
                setError(null);
            }
            return result;
        }
        
        // Se não for array, apenas salva local
        saveLocal(tableName, nextValue);
        return { success: true };
    };

    return [storedValue, setValue, load, loading, error];
}
