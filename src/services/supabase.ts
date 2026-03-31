
import { useState, useEffect, useRef } from 'react';
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

    if (data.length === 0) {
      console.log(`[Supabase] Tabela ${tableName} vazia, nada para sincronizar.`);
      return true;
    }

    console.log(`[Supabase] Iniciando sincronização de ${data.length} itens para ${tableName}...`);
    
    // Limpeza profunda para garantir que não enviamos objetos complexos que o Supabase não suporte
    // Removemos campos que costumam causar erro 400 (colunas inexistentes)
    // Se o objeto veio de um CSV, ele pode ter dezenas de colunas extras
    const cleanData = data.map(item => {
      const cleaned: any = {};
      Object.keys(item).forEach(key => {
        const val = item[key];
        // Garantir que a chave não é vazia, não tem espaços e não tem caracteres especiais que o Supabase/Postgres rejeitaria
        // Também removemos funções e valores undefined
        if (key && key.trim().length > 0 && typeof val !== 'function' && val !== undefined && !key.includes(' ') && !/[áéíóúâêîôûãõàèìòùç]/i.test(key)) {
          cleaned[key] = val;
        }
      });
      return cleaned;
    });

    // Chunking para evitar limites de payload do Supabase/PostgREST (ex: 1000 itens por vez)
    const chunkSize = 500;
    for (let i = 0; i < cleanData.length; i += chunkSize) {
      const chunk = cleanData.slice(i, i + chunkSize);
      const { error } = await supabase
        .from(tableName)
        .upsert(chunk, { onConflict: 'id' });
      
      if (error) {
        console.error(`[Supabase] Erro ao sincronizar chunk ${i/chunkSize} de ${tableName}:`, error.message, error.details, error.hint);
        return false;
      }
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
export function useSupabaseData<T>(tableName: string, initialValue: T): [T, (value: T | ((val: T) => T)) => Promise<boolean>, () => Promise<void>] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    const lastValueRef = useRef<T>(storedValue);

    useEffect(() => {
        lastValueRef.current = storedValue;
    }, [storedValue]);

    const load = async () => {
        const data = await fetchFromSupabase<any>(tableName);
        if (data) {
          setStoredValue(data as unknown as T);
        }
    };

    useEffect(() => {
        load();
    }, [tableName]);

    const setValue = async (value: T | ((val: T) => T)): Promise<boolean> => {
        const nextValue = value instanceof Function ? value(lastValueRef.current) : value;
        
        // Update state and ref
        setStoredValue(nextValue);
        lastValueRef.current = nextValue;

        if (Array.isArray(nextValue)) {
            return await syncToSupabase(tableName, nextValue);
        }
        return true;
    };

    return [storedValue, setValue, load];
}
