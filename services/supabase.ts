
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cktbrxwgqrtgvrbxuqzs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NHVjMcerDg4-2vzNpK-r9A_VjtgB5GQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Função utilitária para sincronizar dados locais com o Supabase
 * @param tableName Nome da tabela no Supabase
 * @param data Array de objetos para salvar
 */
export const syncToSupabase = async (tableName: string, data: any[]) => {
  try {
    const { error } = await supabase
      .from(tableName)
      .upsert(data, { onConflict: 'id' });
    
    if (error) throw error;
    console.log(`Sincronizado com ${tableName}`);
  } catch (err) {
    console.error(`Erro ao sincronizar ${tableName}:`, err);
  }
};

/**
 * Busca dados de uma tabela do Supabase
 */
export const fetchFromSupabase = async <T>(tableName: string): Promise<T[] | null> => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) throw error;
    return data as T[];
  } catch (err) {
    console.error(`Erro ao buscar de ${tableName}:`, err);
    return null;
  }
};
