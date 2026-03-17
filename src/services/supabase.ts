
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cktbrxwgqrtgvrbxuqzs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NHVjMcerDg4-2vzNpK-r9A_VjtgB5GQ';

// Cliente configurado com opções de timeout globais se suportado ou via fetch custom
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-nexus-client': 'teleinfo-platform' }
  }
});

/**
 * Função utilitária para sincronizar dados locais com o Supabase
 */
export const syncToSupabase = async (tableName: string, data: any[]) => {
  try {
    console.log(`Sincronizando ${data.length} itens para a tabela ${tableName}...`);
    const { error } = await supabase
      .from(tableName)
      .upsert(data, { onConflict: 'id' });
    
    if (error) {
      console.error(`Erro ao sincronizar ${tableName}:`, error.message, error.details);
      return false;
    }
    console.log(`Sincronização de ${tableName} concluída com sucesso.`);
    return true;
  } catch (err) {
    console.error(`Falha crítica na sincronização de ${tableName}:`, err);
    return false;
  }
};

/**
 * Busca dados de uma tabela do Supabase com tratamento de erro
 */
export const fetchFromSupabase = async <T>(tableName: string): Promise<T[] | null> => {
  try {
    console.log(`Buscando dados da tabela ${tableName}...`);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error(`Erro ao buscar em ${tableName}:`, error.message, error.details);
      return null;
    }
    console.log(`Busca em ${tableName} concluída. ${data?.length || 0} itens encontrados.`);
    return data as T[];
  } catch (err) {
    console.error(`Falha crítica na busca em ${tableName}:`, err);
    return null;
  }
};

/**
 * Hook para persistência no Supabase
 */
export function useSupabaseData<T>(tableName: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    const load = async () => {
        const data = await fetchFromSupabase<any>(tableName);
        if (data && data.length > 0) setStoredValue(data as unknown as T);
        else if (data && data.length === 0) setStoredValue([] as unknown as T);
    };

    useEffect(() => {
        load();
    }, [tableName]);

    const setValue = (value: T | ((val: T) => T)) => {
        const val = value instanceof Function ? value(storedValue) : value;
        setStoredValue(val);
        if (Array.isArray(val)) syncToSupabase(tableName, val);
    };

    return [storedValue, setValue, load];
}
