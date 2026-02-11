
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { 
  UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare, 
  Save, FilePlus, Trash2, Plus, Download, LayoutDashboard, Target, CheckCircle2, Activity,
  Layers, Clock, ClipboardList, Calendar, Briefcase, ListTodo, Percent, Timer, TrendingUp,
  History
} from 'lucide-react';
import { DetailedProject, DetailedProjectStep, BuHours } from '../types';
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
    'AUTOMAÇÃO': '#a855f7',      // Roxo
    'DEFAULT': '#64748b'
};

const getBuColor = (bu: string) => {
    if (!bu) return BU_COLORS['DEFAULT'];
    const upper = bu.toUpperCase();
    if (upper.includes('INFRA')) return BU_COLORS['INFRAESTRUTURA'];
    if (upper.includes('SEGURANÇA') || upper.includes('SSE') || upper.includes('SEC')) return BU_COLORS['SEGURANÇA'];
    if (upper.includes('TECNOLOGIA') || upper.includes('TI')) return BU_COLORS['TECNOLOGIA'];
    if (upper.includes('AUTOMAÇÃO') || upper.includes('AUT')) return BU_COLORS['AUTOMAÇÃO'];
    return BU_COLORS['DEFAULT'];
};

const getRatioColor = (used: number, sold: number) => {
    if (sold === 0) return '#64748b'; 
    const ratio = used / sold;
    if (ratio > 1) return '#ef4444';   
    if (ratio >= 0.8) return '#f59e0b'; 
    return '#10b981';                
};

// --- UTILS ---

const calculateTimeProgress = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const today = new Date();
    
    if (today < start) return 0;
    if (today > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    return Math.min(100, Math.round((elapsed / total) * 100));
};

const parseGeneralCsv = (text: string): any[] => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const sep = ";";
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
            counts[sRaw] = (counts[sRaw] || 0) + 1;
            totalPerc += p.perc;
            const isNaoIniciado = sUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("NAO INICIADO");
            if (isNaoIniciado) naoIniciados++;
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
            const { error: deleteError } = await supabase.from('general_projects').delete().neq('id', '0');
            if (!deleteError) {
                setProjects(parsed);
                alert("Dados gerais importados com sucesso!");
            } else {
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                    <p className="text-[10px] font-black text-nexus-400 uppercase tracking-widest mb-1">Total de Projetos</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-white">{stats.total}</h3>
                        <Layers className="text-nexus-500" size={20} />
                    </div>
                </div>
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
                <div className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                    <p className="text-[10px] font-black text-nexus-400 uppercase tracking-widest mb-1">Não Iniciados</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-red-400">{stats.naoIniciados}</h3>
                        <Clock className="text-red-500" size={20} />
                    </div>
                </div>
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
                    </div>
                ))}
            </div>

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
                                itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
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
        </div>
    );
};

const MonitoringView: React.FC = () => {
    const [projects, setProjects] = useSupabaseData<DetailedProject[]>('detailed_projects', []);
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [editingProject, setEditingProject] = useState<DetailedProject | null>(null);
    const [tempStepName, setTempStepName] = useState('');
    const [tempStepPerc, setTempStepPerc] = useState<number>(0);

    const handleSave = () => {
        if (!editingProject || !editingProject.name) {
            alert("O nome do projeto é obrigatório.");
            return;
        }
        const id = editingProject.id || `aud-${Date.now()}`;
        const updated = editingProject.id 
            ? projects.map(p => p.id === id ? { ...editingProject, id } : p)
            : [...projects, { ...editingProject, id }];
        setProjects(updated);
        setViewMode('list');
        setEditingProject(null);
    };

    const addStep = () => {
        if (!tempStepName.trim()) return;
        const newStep: DetailedProjectStep = { name: tempStepName, perc: tempStepPerc };
        setEditingProject(prev => prev ? ({ ...prev, steps: [...(prev.steps || []), newStep] }) : null);
        setTempStepName('');
        setTempStepPerc(0);
    };

    const removeStep = (index: number) => {
        setEditingProject(prev => prev ? ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }) : null);
    };

    const updateStepPerc = (index: number, newPerc: number) => {
        setEditingProject(prev => {
            if (!prev) return null;
            const newSteps = [...prev.steps];
            newSteps[index] = { ...newSteps[index], perc: Math.min(100, Math.max(0, newPerc)) };
            return { ...prev, steps: newSteps };
        });
    };

    const updateHour = (bu: keyof BuHours, field: 'sold' | 'used', value: number) => {
        setEditingProject(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [field === 'sold' ? 'soldHours' : 'usedHours']: {
                    ...prev[field === 'sold' ? 'soldHours' : 'usedHours'],
                    [bu]: value
                }
            };
        });
    };

    if (viewMode === 'list') {
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-green-400" /> Auditoria Detalhada de Obras
                    </h3>
                    <button onClick={() => { 
                        setEditingProject({ id: '', name: '', bu: '', start: '', end: '', costCenter: '', steps: [], soldHours: {infra:0,sse:0,ti:0,aut:0}, usedHours: {infra:0,sse:0,ti:0,aut:0} }); 
                        setViewMode('form'); 
                    }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                        <Plus size={18} /> Novo Projeto
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-nexus-800 rounded-xl border-2 border-dashed border-nexus-700 text-nexus-500">
                        <GanttChartSquare size={40} className="mx-auto mb-2 opacity-20" />
                        Nenhuma auditoria cadastrada.
                    </div>
                  ) : (
                    projects.map(p => {
                        const totalSold = (p.soldHours?.infra || 0) + (p.soldHours?.sse || 0) + (p.soldHours?.ti || 0);
                        const totalUsed = (p.usedHours?.infra || 0) + (p.usedHours?.sse || 0) + (p.usedHours?.ti || 0);
                        const hourRatioColor = getRatioColor(totalUsed, totalSold);
                        const timeProgress = calculateTimeProgress(p.start, p.end);
                        const avgExec = p.steps.length > 0 ? p.steps.reduce((acc, s) => acc + s.perc, 0) / p.steps.length : 0;

                        return (
                            <div key={p.id} className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 hover:border-nexus-600 transition-all group relative overflow-hidden flex flex-col min-h-[400px]">
                                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: getBuColor(p.bu || '') }} />
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-white font-bold text-lg">{p.name}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-nexus-900 text-nexus-400 border border-nexus-700">CC: {p.costCenter}</span>
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border" style={{ borderColor: getBuColor(p.bu || ''), color: getBuColor(p.bu || '') }}>{p.bu || 'GERAL'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingProject(p); setViewMode('form'); }} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><GanttChartSquare size={16}/></button>
                                        <button onClick={() => { if(confirm(`Excluir auditoria de ${p.name}?`)) setProjects(projects.filter(x => x.id !== p.id)) }} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4 text-[10px] text-nexus-400">
                                    <div className="flex items-center gap-1"><Calendar size={12}/> Início: <span className="text-white font-mono">{p.start || 'N/A'}</span></div>
                                    <div className="flex items-center gap-1"><Calendar size={12}/> Término: <span className="text-white font-mono">{p.end || 'N/A'}</span></div>
                                </div>

                                {/* Seção de Consumo de Tempo vs Execução */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-nexus-900/50 p-3 rounded-lg border border-nexus-700">
                                        <p className="text-[9px] font-black text-nexus-500 uppercase mb-1">Prazo Decorrido</p>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-xs font-bold text-white">{timeProgress}%</span>
                                            <History size={12} className={timeProgress > 80 ? 'text-red-400' : 'text-blue-400'} />
                                        </div>
                                        <div className="w-full bg-nexus-800 h-1 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${timeProgress}%` }} />
                                        </div>
                                    </div>
                                    <div className="bg-nexus-900/50 p-3 rounded-lg border border-nexus-700">
                                        <p className="text-[9px] font-black text-nexus-500 uppercase mb-1">Execução Média</p>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-xs font-bold text-white">{avgExec.toFixed(0)}%</span>
                                            <TrendingUp size={12} className={avgExec < timeProgress ? 'text-yellow-400' : 'text-green-400'} />
                                        </div>
                                        <div className="w-full bg-nexus-800 h-1 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500" style={{ width: `${avgExec}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Seção de H/H resumida */}
                                <div className="mb-4 bg-nexus-900/50 p-3 rounded-lg border border-nexus-700">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-black text-nexus-500 uppercase">Consumo Global H/H</span>
                                        <span className="text-xs font-bold" style={{ color: hourRatioColor }}>{totalUsed} / {totalSold}h</span>
                                    </div>
                                    <div className="w-full bg-nexus-800 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, totalSold > 0 ? (totalUsed/totalSold)*100 : 0)}%`, backgroundColor: hourRatioColor }} />
                                    </div>
                                    {totalUsed > totalSold && totalSold > 0 && (
                                        <p className="text-[9px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10}/> Orçamento de horas estourado!</p>
                                    )}
                                </div>

                                {p.steps && p.steps.length > 0 && (
                                    <div className="space-y-2 mt-auto">
                                        <p className="text-[9px] font-black text-nexus-500 uppercase">Progresso Detalhado por Fase</p>
                                        <div className="h-28 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={p.steps} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
                                                    <XAxis dataKey="name" stroke="#64748b" fontSize={8} interval={0} hide />
                                                    <YAxis domain={[0, 100]} hide />
                                                    <Bar dataKey="perc" fill={getBuColor(p.bu || '')} radius={[4,4,0,0]} barSize={20}>
                                                        <LabelList dataKey="perc" position="top" fill="#fff" fontSize={9} fontWeight="bold" formatter={(v: number) => `${v}%`} />
                                                    </Bar>
                                                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px'}} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                  )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 bg-nexus-800 p-8 rounded-2xl border border-nexus-700 shadow-2xl animate-fadeIn max-w-7xl mx-auto">
            <div className="flex justify-between items-center border-b border-nexus-700 pb-4">
                <h3 className="text-white font-black text-xl flex items-center gap-3">
                    <FilePlus className="text-blue-500" /> {editingProject?.id ? 'Editar Auditoria' : 'Nova Auditoria de Obra'}
                </h3>
                <button onClick={() => { setViewMode('list'); setEditingProject(null); }} className="p-2 text-nexus-400 hover:text-white transition-colors"><X size={24}/></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUNA 1: DADOS BÁSICOS */}
                <div className="space-y-5">
                    <h4 className="text-nexus-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Briefcase size={14}/> Dados Principais
                    </h4>
                    
                    <div className="space-y-4 bg-nexus-900/50 p-6 rounded-xl border border-nexus-700">
                        <div className="space-y-1">
                            <label className="text-xs text-nexus-500 font-bold uppercase">Nome do Projeto</label>
                            <input type="text" placeholder="Ex: Projeto Shopping Norte" value={editingProject?.name} 
                                   onChange={e => setEditingProject({...editingProject!, name: e.target.value})} 
                                   className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-nexus-500 font-bold uppercase">Centro de Controle</label>
                            <input type="text" placeholder="Ex: CC-2024-001" value={editingProject?.costCenter} 
                                   onChange={e => setEditingProject({...editingProject!, costCenter: e.target.value})} 
                                   className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-nexus-500 font-bold uppercase">BU Principal</label>
                            <select value={editingProject?.bu} onChange={e => setEditingProject({...editingProject!, bu: e.target.value})}
                                    className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none appearance-none">
                                <option value="">Selecione...</option>
                                <option value="INFRAESTRUTURA">Infraestrutura</option>
                                <option value="SEGURANÇA">Segurança (SEC)</option>
                                <option value="TECNOLOGIA">Tecnologia (TI)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-nexus-500 font-bold uppercase">Início</label>
                                <input type="date" value={editingProject?.start} 
                                       onChange={e => setEditingProject({...editingProject!, start: e.target.value})} 
                                       className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-nexus-500 font-bold uppercase">Término</label>
                                <input type="date" value={editingProject?.end} 
                                       onChange={e => setEditingProject({...editingProject!, end: e.target.value})} 
                                       className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: FASES E PERCENTUAL */}
                <div className="space-y-5">
                    <h4 className="text-nexus-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <ListTodo size={14}/> Fases & Percentual
                    </h4>
                    
                    <div className="space-y-4 bg-nexus-900/50 p-6 rounded-xl border border-nexus-700">
                        <div className="flex gap-2">
                            <input type="text" placeholder="Nova Fase" value={tempStepName}
                                   onChange={e => setTempStepName(e.target.value)}
                                   className="flex-1 bg-nexus-900 border border-nexus-700 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-500" />
                            <input type="number" placeholder="%" value={tempStepPerc}
                                   onChange={e => setTempStepPerc(Number(e.target.value))}
                                   className="w-16 bg-nexus-900 border border-nexus-700 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-500" />
                            <button onClick={addStep} className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white transition-colors shadow-lg"><Plus size={20}/></button>
                        </div>

                        <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {editingProject?.steps.map((s, idx) => (
                                <div key={idx} className="bg-nexus-800 p-3 rounded-lg border border-nexus-700">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-white uppercase">{s.name}</span>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={s.perc} onChange={e => updateStepPerc(idx, Number(e.target.value))}
                                                   className="w-12 bg-nexus-900 border border-nexus-600 rounded text-[10px] text-center text-blue-400 outline-none focus:border-blue-500" />
                                            <button onClick={() => removeStep(idx)} className="text-nexus-500 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                    <div className="w-full bg-nexus-900 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${s.perc}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {editingProject?.steps && editingProject.steps.length > 0 && (
                            <div className="h-32 w-full mt-4 border-t border-nexus-700 pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={editingProject.steps} margin={{top: 20, left: -25, right: 10}}>
                                        <XAxis dataKey="name" hide />
                                        <Bar dataKey="perc" fill="#3b82f6" radius={[4,4,0,0]}>
                                            <LabelList dataKey="perc" position="top" fill="#fff" fontSize={10} formatter={(v:any) => `${v}%`}/>
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA 3: H/H VENDIDAS X UTILIZADAS */}
                <div className="space-y-5">
                    <h4 className="text-nexus-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Timer size={14}/> Gestão de Hora-Homem (H/H)
                    </h4>
                    
                    <div className="space-y-6 bg-nexus-900/50 p-6 rounded-xl border border-nexus-700">
                        {(['infra', 'sse', 'ti'] as const).map(bu => {
                            const label = bu === 'infra' ? 'INFRA' : bu === 'sse' ? 'SEC (Segurança)' : 'TI (Tecnologia)';
                            const sold = editingProject?.soldHours?.[bu] || 0;
                            const used = editingProject?.usedHours?.[bu] || 0;
                            const color = getRatioColor(used, sold);

                            return (
                                <div key={bu} className="space-y-2 p-3 bg-nexus-800 rounded-lg border border-nexus-700 transition-all" style={{ borderLeft: `3px solid ${color}` }}>
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] font-black text-white uppercase">{label}</p>
                                        {sold > 0 && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm" style={{ backgroundColor: `${color}20`, color: color }}>
                                                {((used/sold)*100).toFixed(0)}% Utilizado
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-nexus-500 font-bold uppercase">H/Vendida</label>
                                            <input type="number" value={sold} onChange={e => updateHour(bu, 'sold', Number(e.target.value))}
                                                   className="w-full bg-nexus-900 border border-nexus-700 rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-nexus-500 font-bold uppercase">H/Utiliza</label>
                                            <input type="number" value={used} onChange={e => updateHour(bu, 'used', Number(e.target.value))}
                                                   className="w-full bg-nexus-900 border border-nexus-700 rounded p-1.5 text-xs text-white outline-none" style={{ borderColor: color }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Gráfico Comparativo de Horas */}
                        <div className="h-44 w-full mt-4 pt-4 border-t border-nexus-700">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                    data={[
                                        { name: 'INFRA', Vendido: editingProject?.soldHours?.infra || 0, Utilizado: editingProject?.usedHours?.infra || 0 },
                                        { name: 'SEC', Vendido: editingProject?.soldHours?.sse || 0, Utilizado: editingProject?.usedHours?.sse || 0 },
                                        { name: 'TI', Vendido: editingProject?.soldHours?.ti || 0, Utilizado: editingProject?.usedHours?.ti || 0 },
                                    ]}
                                    margin={{top: 20, left: -25, right: 10}}
                                >
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '8px'}} />
                                    <Bar dataKey="Vendido" fill="#334155" radius={[4,4,0,0]} barSize={12} />
                                    <Bar dataKey="Utilizado" radius={[4,4,0,0]} barSize={12}>
                                        { [
                                            getRatioColor(editingProject?.usedHours?.infra || 0, editingProject?.soldHours?.infra || 0),
                                            getRatioColor(editingProject?.usedHours?.sse || 0, editingProject?.soldHours?.sse || 0),
                                            getRatioColor(editingProject?.usedHours?.ti || 0, editingProject?.soldHours?.ti || 0)
                                          ].map((c, i) => <Cell key={i} fill={c} />)
                                        }
                                        <LabelList dataKey="Utilizado" position="top" fill="#fff" fontSize={9} fontWeight="bold" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-nexus-700 mt-8">
                <button onClick={() => { setViewMode('list'); setEditingProject(null); }} className="px-6 py-2.5 text-nexus-400 font-bold hover:text-white transition-colors">Cancelar</button>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 font-black shadow-xl shadow-blue-900/40 active:scale-95 transition-all">
                    <Save size={20} /> Salvar Auditoria no Supabase
                </button>
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
