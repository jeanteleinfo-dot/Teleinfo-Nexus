
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
    if (!data || !Array.isArray(data)) {
      console.warn(`Dados inválidos para sincronização em ${tableName}:`, data);
      return false;
    }

    console.log(`[Supabase] Iniciando sincronização de ${data.length} itens para ${tableName}...`);
    
    // Limpeza profunda para garantir que não enviamos objetos complexos que o Supabase não suporte
    // ou que possam causar erros de serialização se não forem JSONB
    const cleanData = data.map(item => {
      const { ...rest } = item;
      return rest;
    });

    const { error } = await supabase
      .from(tableName)
      .upsert(cleanData, { onConflict: 'id' });
    
    if (error) {
      console.error(`[Supabase] Erro ao sincronizar ${tableName}:`, error.message, error.details, error.hint);
      return false;
    }
    
    console.log(`[Supabase] Sincronização de ${tableName} concluída com sucesso.`);
    return true;
  } catch (err) {
    console.error(`[Supabase] Falha crítica na sincronização de ${tableName}:`, err);
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
      // Não alertamos no fetch para não atrapalhar a experiência inicial se a tabela estiver vazia
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
        setStoredValue(prev => {
            const next = value instanceof Function ? value(prev) : value;
            if (Array.isArray(next)) {
                // Sincroniza de forma assíncrona sem bloquear o estado
                syncToSupabase(tableName, next);
            }
            return next;
        });
    };

    return [storedValue, setValue, load];
}
