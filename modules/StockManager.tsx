
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { ProjectBuyingStatus } from '../types';
import { 
  Package, UploadCloud, AlertTriangle, CheckCircle, Clock, X, ShoppingCart, Trash2, Info, Eye
} from 'lucide-react';
import { supabase, syncToSupabase, fetchFromSupabase } from '../services/supabase';

// --- UTILS ---

function useSupabaseData<T>(tableName: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    const loadData = async () => {
        const data = await fetchFromSupabase<any>(tableName);
        if (data) {
            setStoredValue(data as unknown as T);
        }
    };

    useEffect(() => {
        loadData();
    }, [tableName]);

    const setValue = (value: T | ((val: T) => T)) => {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (Array.isArray(valueToStore)) {
            syncToSupabase(tableName, valueToStore);
        }
    };

    return [storedValue, setValue, loadData];
}

const parseBuyingStatusCSV = (text: string): ProjectBuyingStatus[] => {
    // Remove BOM se existir
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    
    // Parser robusto para CSV que lida com aspas e quebras de linha dentro de campos
    const parseCSVLine = (text: string, separator: string) => {
        const result = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];
            if (char === '"' && inQuote && next === '"') {
                cur += '"';
                i++;
            } else if (char === '"') {
                inQuote = !inQuote;
            } else if (char === separator && !inQuote) {
                result.push(cur);
                cur = '';
            } else if ((char === '\r' || char === '\n') && !inQuote) {
                if (cur || result.length > 0) {
                    result.push(cur);
                    return { fields: result, nextIndex: i + (char === '\r' && next === '\n' ? 2 : 1) };
                }
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return { fields: result, nextIndex: text.length };
    };

    // Detectar separador
    const firstLine = text.split('\n')[0];
    const sep = firstLine.includes(';') ? ';' : ',';
    
    const result: ProjectBuyingStatus[] = [];
    let index = 0;
    let lineCount = 0;
    
    while (index < text.length) {
        const { fields, nextIndex } = parseCSVLine(text.substring(index), sep);
        index += nextIndex;
        
        if (fields.length < 3 || lineCount === 0) {
            lineCount++;
            continue;
        }

        const rawStatus = fields[2] || 'Padrão';
        const aComprar = fields[3] || '-';
        
        let status: 'Padrão' | 'Intermediário' | 'Crítico' = 'Padrão';
        const s = rawStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (s.includes('critico') || s.includes('alta') || s.includes('urgente') || s.includes('critical') || s.includes('atrasado')) {
            status = 'Crítico';
        } else if (s.includes('intermediario') || s.includes('media') || s.includes('atencao') || s.includes('alerta')) {
            status = 'Intermediário';
        } else if (aComprar !== '-' && aComprar.trim() !== '' && aComprar.toLowerCase() !== 'nenhum' && status === 'Padrão') {
            const a = aComprar.toLowerCase();
            if (a.includes('urgente') || a.includes('pendente') || a.includes('atraso')) {
                status = 'Crítico';
            } else {
                status = 'Intermediário';
            }
        }
        
        result.push({
            id: `buy-${lineCount}-${Date.now()}`,
            projeto: fields[0] || 'N/A',
            numeroProjeto: fields[1] || 'N/A',
            status: status,
            aComprar: aComprar,
            comprados: fields[4] || '-',
            entregue: fields[5] || '-',
            dataDisponivel: fields[6] || 'A definir',
        });
        lineCount++;
    }
    return result;
};

// --- COMPONENTS ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string; textColor: string }> = ({ title, value, icon, colorClass, textColor }) => (
    <div className="bg-nexus-800 rounded-xl border border-nexus-700 p-5 flex items-start justify-between shadow-lg">
      <div>
        <p className="text-xs font-semibold text-nexus-400 uppercase tracking-wider mb-1">{title}</p>
        <h3 className={`text-2xl font-bold ${textColor}`}>{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass} text-white shadow-inner`}>{icon}</div>
    </div>
);

const DetailModal: React.FC<{ project: ProjectBuyingStatus; onClose: () => void }> = ({ project, onClose }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-nexus-800 border-2 border-red-500/50 rounded-2xl w-full max-w-4xl shadow-2xl animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 text-white">
                    <AlertTriangle size={24} />
                    <h3 className="font-bold text-lg">Detalhes Críticos do Projeto</h3>
                </div>
                <button onClick={onClose} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-[10px] uppercase font-bold text-nexus-500">Título do Projeto</label>
                        <p className="text-lg font-bold text-white">{project.projeto}</p>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-nexus-500">Nº CC / Projeto</label>
                        <p className="text-white font-mono">{project.numeroProjeto}</p>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-nexus-500">Criticidade</label>
                        <span className="block w-fit bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded mt-1">CRÍTICO</span>
                    </div>
                </div>

                <div className="border-t border-nexus-700 pt-4 grid grid-cols-1 gap-4">
                    <div className="bg-nexus-900 p-4 rounded-lg border border-nexus-700">
                        <label className="text-[10px] uppercase font-bold text-nexus-400">Materiais a Comprar</label>
                        <p className="text-red-400 text-sm mt-2 font-medium whitespace-pre-wrap leading-relaxed">{project.aComprar}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-nexus-900 p-4 rounded-lg border border-nexus-700">
                            <label className="text-[10px] uppercase font-bold text-nexus-400">Já Comprados</label>
                            <p className="text-nexus-200 text-sm mt-2 whitespace-pre-wrap leading-relaxed">{project.comprados}</p>
                        </div>
                        <div className="bg-nexus-900 p-4 rounded-lg border border-nexus-700">
                            <label className="text-[10px] uppercase font-bold text-nexus-400">Entregues</label>
                            <p className="text-nexus-200 text-sm mt-2 whitespace-pre-wrap leading-relaxed">{project.entregue}</p>
                        </div>
                    </div>
                    <div className="bg-blue-600/10 p-4 rounded-lg border border-blue-500/30">
                        <label className="text-[10px] uppercase font-bold text-blue-400">Data Disponível p/ Cliente</label>
                        <p className="text-white text-sm mt-1 font-bold">{project.dataDisponivel}</p>
                    </div>
                </div>
            </div>
            
            <div className="bg-nexus-900 p-4 border-t border-nexus-700 flex justify-end shrink-0">
                <button onClick={onClose} className="px-6 py-2 bg-nexus-700 text-white rounded-lg hover:bg-nexus-600 transition-colors font-bold text-sm">Fechar</button>
            </div>
        </div>
    </div>
);

// --- MAIN VIEW ---

const ProjectBuyingStatusView: React.FC = () => {
    const [buyingData, setBuyingData, reload] = useSupabaseData<ProjectBuyingStatus[]>('buying_status', []);
    const [selectedProject, setSelectedProject] = useState<ProjectBuyingStatus | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stats = useMemo(() => ({
        total: buyingData?.length || 0,
        padrao: buyingData?.filter(p => p.status === 'Padrão').length || 0,
        intermediario: buyingData?.filter(p => p.status === 'Intermediário').length || 0,
        critico: buyingData?.filter(p => p.status === 'Crítico').length || 0,
    }), [buyingData]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const parsed = parseBuyingStatusCSV(evt.target?.result as string);
            
            // "Ficar fixado até outro ser importado": 
            // Limpamos os dados antigos antes de inserir os novos para manter integridade.
            const { error: deleteError } = await supabase.from('buying_status').delete().neq('id', '0');
            
            if (!deleteError) {
                setBuyingData(parsed);
                alert("Dados de estoque atualizados com sucesso!");
            } else {
                console.error("Erro ao limpar dados antigos:", deleteError);
                // Mesmo com erro na limpeza, tentamos salvar por cima
                setBuyingData(parsed);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header com Importação */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShoppingCart size={24} className="text-blue-400"/> Status de Compras
                </h3>
                <div className="flex items-center gap-2">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/40"
                    >
                        <UploadCloud size={18} /> Importar Planilha CSV
                    </button>
                    {buyingData?.length > 0 && (
                        <button 
                            onClick={async () => {
                                if(confirm("Deseja realmente apagar todos os dados de compras?")) {
                                    await supabase.from('buying_status').delete().neq('id', '0');
                                    setBuyingData([]);
                                }
                            }} 
                            className="p-2.5 text-nexus-400 hover:text-red-400 bg-nexus-800 hover:bg-red-500/10 rounded-xl transition-all border border-nexus-700"
                        >
                            <Trash2 size={20}/>
                        </button>
                    )}
                </div>
            </div>

            {/* Painel de Estatísticas - 4 Indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Mapeado" 
                    value={stats.total} 
                    icon={<Package size={22}/>} 
                    colorClass="bg-blue-600" 
                    textColor="text-white"
                />
                <StatCard 
                    title="Padrão" 
                    value={stats.padrao} 
                    icon={<CheckCircle size={22}/>} 
                    colorClass="bg-green-600" 
                    textColor="text-green-400"
                />
                <StatCard 
                    title="Intermediário" 
                    value={stats.intermediario} 
                    icon={<Clock size={22}/>} 
                    colorClass="bg-yellow-600" 
                    textColor="text-yellow-400"
                />
                <StatCard 
                    title="Crítico" 
                    value={stats.critico} 
                    icon={<AlertTriangle size={22}/>} 
                    colorClass="bg-red-600" 
                    textColor="text-red-400"
                />
            </div>

            {/* Lista de Projetos com Cores */}
            <div className="bg-nexus-800 rounded-2xl border border-nexus-700 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-nexus-900 text-nexus-400 uppercase font-black text-[10px] tracking-widest">
                            <tr>
                                <th className="px-6 py-5">Título do Projeto</th>
                                <th className="px-6 py-5">Nº / Centro de Controle</th>
                                <th className="px-6 py-5">Criticidade</th>
                                <th className="px-6 py-5">A Comprar</th>
                                <th className="px-6 py-5">Data Disponível</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-nexus-700">
                            {buyingData?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-nexus-500 italic">
                                        Nenhum dado importado. Por favor, carregue o arquivo CSV de compras.
                                    </td>
                                </tr>
                            ) : (
                                buyingData.map((item) => {
                                    const isCritico = item.status === 'Crítico';
                                    const isIntermediario = item.status === 'Intermediário';
                                    
                                    const rowStyle = isCritico 
                                        ? 'text-red-400 hover:bg-red-500/10 cursor-pointer border-l-4 border-red-500' 
                                        : isIntermediario 
                                        ? 'text-yellow-400 hover:bg-yellow-500/5 border-l-4 border-yellow-500' 
                                        : 'text-green-400 hover:bg-green-500/5 border-l-4 border-green-500';

                                    const badgeStyle = isCritico
                                        ? 'bg-red-500 text-white'
                                        : isIntermediario
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white';

                                    return (
                                        <tr 
                                            key={item.id} 
                                            className={`transition-all ${rowStyle}`}
                                            onClick={() => isCritico && setSelectedProject(item)}
                                        >
                                            <td className="px-6 py-5 font-bold flex items-center gap-2">
                                                {item.projeto}
                                                {isCritico && <Eye size={14} className="opacity-50" />}
                                            </td>
                                            <td className="px-6 py-5 font-mono text-xs opacity-80">{item.numeroProjeto}</td>
                                            <td className="px-6 py-5">
                                                <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase shadow-sm ${badgeStyle}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-nexus-200 max-w-xs truncate" title={item.aComprar}>{item.aComprar}</td>
                                            <td className="px-6 py-5 font-bold">{item.dataDisponivel}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalhes para Críticos */}
            {selectedProject && (
                <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />
            )}
        </div>
    );
};

export const StockManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'control' | 'status'>('status');

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestão de Estoque & Compras</h2>
          <p className="text-nexus-400 text-sm">Controle de insumos e criticidade de aquisições</p>
        </div>
        <div className="flex bg-nexus-800 p-1.5 rounded-xl border border-nexus-700 shadow-xl">
            {['status', 'monitor', 'control'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-500 hover:text-white'}`}
                >
                    {tab === 'status' ? 'Status Compras' : tab === 'monitor' ? 'SLA Triagem' : 'Fases de Obra'}
                </button>
            ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
          {activeTab === 'status' && <ProjectBuyingStatusView />}
          {activeTab !== 'status' && (
              <div className="flex flex-col items-center justify-center h-64 bg-nexus-800/30 rounded-2xl border-2 border-dashed border-nexus-700">
                  <Clock size={48} className="text-nexus-600 mb-3" />
                  <p className="text-nexus-500 font-medium">Módulo em desenvolvimento</p>
              </div>
          )}
      </div>
    </div>
  );
};
