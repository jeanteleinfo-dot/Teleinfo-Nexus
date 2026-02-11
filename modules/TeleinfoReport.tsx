
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare, 
  Save, FilePlus, Trash2, Plus, Download, LayoutDashboard, Target, CheckCircle2, Activity, PieChart as PieIcon,
  Layers, Clock, ClipboardList
} from 'lucide-react';
import { generateProjectRiskAnalysis, generateDetailedProjectRiskAnalysis } from '../services/geminiService';
import { Project, DetailedProject, ProductionData } from '../types';
import { supabase, syncToSupabase, fetchFromSupabase } from '../services/supabase';

// Hook para persistência no Supabase
function useSupabaseData<T>(tableName: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
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

// --- CONSTANTES DE CORES ---
const BU_COLORS: Record<string, string> = {
    'INFRAESTRUTURA': '#f97316', // Laranja
    'SEGURANÇA': '#22c55e',      // Verde
    'TECNOLOGIA': '#3b82f6',     // Azul
    'AUTOMAÇÃO': '#94a3b8',      // Cinza
    'DEFAULT': '#64748b'
};

const getBuColor = (bu: string) => {
    const upper = bu.toUpperCase();
    if (upper.includes('INFRA')) return BU_COLORS['INFRAESTRUTURA'];
    if (upper.includes('SEGURANÇA') || upper.includes('SSE')) return BU_COLORS['SEGURANÇA'];
    if (upper.includes('TECNOLOGIA') || upper.includes('TI')) return BU_COLORS['TECNOLOGIA'];
    if (upper.includes('AUTOMAÇÃO') || upper.includes('AUT')) return BU_COLORS['AUTOMAÇÃO'];
    return BU_COLORS['DEFAULT'];
};

// --- UTILS ---

const parseGeneralCsv = (text: string): any[] => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    
    const sep = ";";
    // ITEM; CLIENTE; TIPO DE PROJETO; TIPO DE PRODUTO; SQUAD LEADER; BUs; C.Custo; ESCOPO; STATUS; %
    return lines.slice(1).map((line, idx) => {
        const cells = line.split(sep);
        const percRaw = cells[9]?.replace('%', '').replace(',', '.').trim();
        return {
            id: `gen-${idx}-${Date.now()}`,
            item: cells[0]?.trim() || "",
            cliente: cells[1]?.trim() || "",
            tipoProjeto: cells[2]?.trim() || "",
            tipoProduto: cells[3]?.trim() || "",
            squadLeader: cells[4]?.trim() || "",
            bus: cells[5]?.trim() || "",
            cCusto: cells[6]?.trim() || "",
            escopo: cells[7]?.trim() || "",
            status: cells[8]?.trim() || "",
            perc: parseFloat(percRaw) || 0
        };
    });
};

// --- COMPONENTS ---

const GeneralDashboardView: React.FC = () => {
    const [projects, setProjects] = useSupabaseData<any[]>('general_projects', []);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stats = useMemo(() => {
        if (!projects.length) return { statusCounts: {}, avgCompletion: 0, total: 0, naoIniciados: 0 };
        const counts: Record<string, number> = {};
        let totalPerc = 0;
        let naoIniciados = 0;
        
        projects.forEach(p => {
            const sRaw = p.status?.trim() || 'NÃO DEFINIDO';
            const sUpper = sRaw.toUpperCase();
            
            // Incrementar contagem por status (baseado na coluna STATUS)
            counts[sRaw] = (counts[sRaw] || 0) + 1;
            
            totalPerc += p.perc;
            
            // CORREÇÃO: Lógica baseada exclusivamente no texto da coluna Status (ignora acentos e espaços extras)
            const isNaoIniciado = sUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("NAO INICIADO");
            
            if (isNaoIniciado) {
                naoIniciados++;
            }
        });

        return {
            statusCounts: counts,
            avgCompletion: (totalPerc / projects.length).toFixed(1),
            total: projects.length,
            naoIniciados: naoIniciados
        };
    }, [projects]);

    const buData = useMemo(() => {
        const bus: Record<string, number> = {};
        projects.forEach(p => {
            const b = p.bus || 'OUTROS';
            bus[b] = (bus[b] || 0) + 1;
        });
        return Object.entries(bus).map(([name, value]) => ({ name, value }));
    }, [projects]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const parsed = parseGeneralCsv(evt.target?.result as string);
            // Fixar no sistema: Limpa antigos e sincroniza novos via Supabase
            const { error: deleteError } = await supabase.from('general_projects').delete().neq('id', '0');
            
            if (!deleteError) {
                setProjects(parsed);
                alert("Dados gerais importados e fixados no sistema!");
            } else {
                console.error("Erro ao sincronizar:", deleteError);
                setProjects(parsed);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <LayoutDashboard className="text-blue-400" /> Visão Geral de Projetos
                </h3>
                <div className="flex gap-2">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/40">
                        <UploadCloud size={18} /> Importar Geral CSV
                    </button>
                    {projects.length > 0 && (
                        <button onClick={async () => { if(confirm("Apagar todos os projetos gerais?")) { await supabase.from('general_projects').delete().neq('id', '0'); setProjects([]); }}} className="p-2 bg-nexus-800 border border-nexus-700 text-red-400 rounded-lg hover:bg-red-500/10">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Painel de Indicadores Baseados na Coluna Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Total de Projetos */}
                <div className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                    <p className="text-[10px] font-black text-nexus-400 uppercase tracking-widest mb-1">Total de Projetos</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-white">{stats.total}</h3>
                        <Layers className="text-nexus-500" size={20} />
                    </div>
                </div>

                {/* Finalização Global */}
                <div className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-black text-nexus-400 uppercase tracking-widest">Finalização Global</p>
                        <Target className="text-blue-400" size={18} />
                    </div>
                    <h3 className="text-3xl font-black text-white">{stats.avgCompletion}%</h3>
                    <div className="w-full bg-nexus-900 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${stats.avgCompletion}%` }} />
                    </div>
                </div>

                {/* Não Iniciados - CORRIGIDO */}
                <div className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                    <p className="text-[10px] font-black text-nexus-400 uppercase tracking-widest mb-1">Não Iniciados</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-red-400">{stats.naoIniciados}</h3>
                        <Clock className="text-red-500" size={20} />
                    </div>
                </div>

                {/* Painéis Dinâmicos baseados nos outros Status encontrados na planilha */}
                {Object.entries(stats.statusCounts)
                  .filter(([status]) => {
                      const s = status.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      return !s.includes('NAO INICIADO');
                  })
                  .slice(0, 2).map(([status, count]) => (
                    <div key={status} className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-black text-nexus-400 uppercase tracking-tighter truncate w-3/4">{status}</p>
                            <ClipboardList className="text-green-500" size={16} />
                        </div>
                        <h3 className="text-3xl font-black text-white">{count}</h3>
                        <p className="text-[9px] text-nexus-500 mt-1">Quantidade por Status</p>
                    </div>
                ))}
            </div>

            {/* Gráfico Status por Unidade */}
            <div className="w-full bg-nexus-800 p-6 rounded-xl border border-nexus-700 shadow-xl">
                <h4 className="text-white font-bold mb-6 flex items-center gap-2 text-sm">
                    <Activity size={16} className="text-blue-400" /> Status por Unidade de Negócio (BUs)
                </h4>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={buData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                            <Tooltip 
                                cursor={{ fill: '#1e293b' }} 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff', fontWeight: 'bold' }} // Hover com texto branco (CORREÇÃO DE CORES)
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                                {buData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getBuColor(entry.name)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Lista Colorida por BU */}
            <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden shadow-2xl">
                <div className="p-4 bg-nexus-900/40 border-b border-nexus-700 flex justify-between items-center">
                    <h4 className="text-white font-bold text-sm">Lista de Obras</h4>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-[9px] text-nexus-400 font-bold uppercase">INFRA</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[9px] text-nexus-400 font-bold uppercase">SEGURANÇA</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[9px] text-nexus-400 font-bold uppercase">TECNOLOGIA</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-[9px] text-nexus-400 font-bold uppercase">AUTOMAÇÃO</span></div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-nexus-900/80 text-nexus-500 uppercase font-black text-[10px] tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4">Cliente / Projeto</th>
                                <th className="px-6 py-4">BU / Squad</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-nexus-700">
                            {projects.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-nexus-500 italic">Carregue a planilha geral para visualizar os dados.</td>
                                </tr>
                            ) : (
                                projects.map((p) => {
                                    const color = getBuColor(p.bus);
                                    return (
                                        <tr key={p.id} className="hover:bg-nexus-700/20 transition-all border-l-4" style={{ borderColor: color }}>
                                            <td className="px-6 py-4 font-mono text-xs text-nexus-400">#{p.item}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white text-sm">{p.cliente}</span>
                                                    <span className="text-[10px] text-nexus-400 uppercase">{p.tipoProjeto}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold" style={{ color: color }}>{p.bus}</span>
                                                    <span className="text-[10px] text-nexus-500">{p.squadLeader}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-nexus-900 border border-nexus-700 text-nexus-300">
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-black ${p.perc === 100 ? 'text-green-500' : 'text-white'}`}>{p.perc}%</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const MonitoringView: React.FC = () => {
    const [projects, setProjects] = useSupabaseData<DetailedProject[]>('detailed_projects', []);
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [editingProject, setEditingProject] = useState<DetailedProject | null>(null);

    const handleSave = () => {
        if (!editingProject || !editingProject.name) return;
        const id = editingProject.id || Date.now().toString();
        const updated = editingProject.id 
            ? projects.map(p => p.id === id ? editingProject : p)
            : [...projects, { ...editingProject, id }];
        setProjects(updated);
        setViewMode('list');
    };

    if (viewMode === 'list') {
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Auditoria Detalhada de Obras</h3>
                    <button onClick={() => { setEditingProject({ id: '', name: '', start: '', end: '', steps: [], soldHours: {infra:0,sse:0,ti:0,aut:0}, usedHours: {infra:0,sse:0,ti:0,aut:0} }); setViewMode('form'); }} 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Plus size={18} /> Novo Projeto
                    </button>
                </div>
                <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
                    <table className="w-full text-left text-sm text-nexus-300">
                        <thead className="bg-nexus-900/50 text-nexus-400 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Projeto</th>
                                <th className="px-6 py-4">Centro de Custo</th>
                                <th className="px-6 py-4">Início</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-nexus-700">
                            {projects.map(p => (
                                <tr key={p.id} className="hover:bg-nexus-700/30">
                                    <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                                    <td className="px-6 py-4 font-mono">{p.costCenter}</td>
                                    <td className="px-6 py-4">{p.start}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setEditingProject(p); setViewMode('form'); }} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded"><GanttChartSquare size={16}/></button>
                                            <button onClick={() => setProjects(projects.filter(x => x.id !== p.id))} className="p-2 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 bg-nexus-800 p-6 rounded-xl border border-nexus-700">
            <h3 className="text-white font-bold text-lg">Editar Obra</h3>
            <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Nome" value={editingProject?.name} onChange={e => setEditingProject({...editingProject!, name: e.target.value})} className="bg-nexus-900 border border-nexus-600 rounded p-2 text-white" />
                <input type="text" placeholder="C/C" value={editingProject?.costCenter} onChange={e => setEditingProject({...editingProject!, costCenter: e.target.value})} className="bg-nexus-900 border border-nexus-600 rounded p-2 text-white" />
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={() => setViewMode('list')} className="px-4 py-2 text-nexus-400">Cancelar</button>
                <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-lg">Salvar no Supabase</button>
            </div>
        </div>
    );
};

export const TeleinfoReport: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'presentation'>('dashboard');

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Relatórios & Auditoria IA</h2>
                  <p className="text-nexus-400 text-sm">Visão executiva e auditoria de obras Teleinfo</p>
                </div>
                <div className="flex bg-nexus-800 p-1.5 rounded-xl border border-nexus-700 shadow-xl">
                    {['dashboard', 'monitoring', 'presentation'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-500 hover:text-white'}`}>
                            {tab === 'dashboard' ? 'Geral' : tab === 'monitoring' ? 'Auditoria' : 'Slides'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0">
                {activeTab === 'dashboard' && <GeneralDashboardView />}
                {activeTab === 'monitoring' && <MonitoringView />}
                {activeTab === 'presentation' && (
                  <div className="flex flex-col items-center justify-center h-64 bg-nexus-800/30 rounded-2xl border-2 border-dashed border-nexus-700">
                      <FilePlus size={48} className="text-nexus-600 mb-3" />
                      <p className="text-nexus-500 font-medium">Módulo de Apresentação em desenvolvimento</p>
                  </div>
                )}
            </div>
        </div>
    );
};
