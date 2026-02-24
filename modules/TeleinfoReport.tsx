
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, PieChart, Pie
} from 'recharts';
import { 
  UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare, 
  Save, FilePlus, Trash2, Plus, Download, LayoutDashboard, Target, CheckCircle2, Activity,
  Layers, Clock, ClipboardList, Calendar, Briefcase, ListTodo, Percent, Timer, TrendingUp,
  History, ChevronLeft, ChevronRight, Maximize2, MonitorPlay, ShoppingCart, UserCheck, Eye,
  FileSearch, Loader2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { DetailedProject, DetailedProjectStep, BuHours, ProjectBuyingStatus } from '../types';
import { supabase, syncToSupabase, fetchFromSupabase } from '../services/supabase';
import { generateSeniorPlanningAuditReport } from '../services/geminiService';

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
    'INFRAESTRUTURA': '#f97316',
    'SEGURANÇA': '#22c55e',
    'TECNOLOGIA': '#3b82f6',
    'AUTOMAÇÃO': '#a855f7',
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
        if (!projects.length) return { statusCounts: {}, avgCompletion: 0, total: 0, naoIniciados: 0, emAndamento: 0 };
        const counts: Record<string, number> = {};
        let totalPerc = 0;
        let naoIniciados = 0;
        let emAndamento = 0;
        projects.forEach(p => {
            const sRaw = p.status?.trim() || 'NÃO DEFINIDO';
            const sUpper = sRaw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            counts[sRaw] = (counts[sRaw] || 0) + 1;
            totalPerc += p.perc;
            
            if (sUpper.includes("NAO INICIADO")) {
                naoIniciados++;
            } else if (sUpper.includes("EM ANDAMENTO") || sUpper.includes("INICIADO") || (p.perc > 0 && p.perc < 100)) {
                emAndamento++;
            }
        });
        return {
            statusCounts: counts,
            avgCompletion: (totalPerc / projects.length).toFixed(1),
            total: projects.length,
            naoIniciados: naoIniciados,
            emAndamento: emAndamento
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
                <div className="bg-nexus-800 p-5 rounded-xl border border-nexus-700 shadow-xl">
                    <p className="text-[10px] font-black text-nexus-400 uppercase tracking-widest mb-1">Em Andamento</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-blue-400">{stats.emAndamento}</h3>
                        <Activity className="text-blue-500" size={20} />
                    </div>
                </div>
                {Object.entries(stats.statusCounts)
                  .filter(([status]) => {
                      const s = status.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      return !s.includes('NAO INICIADO') && !s.includes('EM ANDAMENTO') && !s.includes('INICIADO');
                  })
                  .slice(0, 1).map(([status, count]) => (
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

interface MonitoringProps {
    onGenerateAiReport: (project: DetailedProject) => void;
    isGeneratingReport: boolean;
}

const MonitoringView: React.FC<MonitoringProps> = ({ onGenerateAiReport, isGeneratingReport }) => {
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
                    }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-blue-900/40 active:scale-95 transition-all">
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
                                        <button 
                                            onClick={() => onGenerateAiReport(p)} 
                                            disabled={isGeneratingReport}
                                            className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center gap-1"
                                            title="Gerar Relatório Auditoria Sênior IA"
                                        >
                                            {isGeneratingReport ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16}/>}
                                        </button>
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

// --- NOVO COMPONENTE DE APRESENTAÇÃO ATUALIZADO ---

interface PresentationProps {
    generalProjects: any[];
    detailedProjects: DetailedProject[];
    buyingStatus: ProjectBuyingStatus[];
    onGenerateAiReport: (project: DetailedProject) => void;
    isGeneratingReport: boolean;
}

const PresentationView: React.FC<PresentationProps> = ({ generalProjects, detailedProjects, buyingStatus, onGenerateAiReport, isGeneratingReport }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedBuyingDetail, setSelectedBuyingDetail] = useState<ProjectBuyingStatus | null>(null);

    // Slides dinâmicos: Capa(1) + Portfólio(1) + BU(1) + Compras(1) + Obras(N) + Final(1)
    const projectSlidesCount = detailedProjects.length;
    const slidesCount = 5 + projectSlidesCount;

    const nextSlide = useCallback(() => setCurrentSlide(prev => (prev + 1) % slidesCount), [slidesCount]);
    const prevSlide = useCallback(() => setCurrentSlide(prev => (prev - 1 + slidesCount) % slidesCount), [slidesCount]);
    const exitPresentation = useCallback(() => { setIsFullScreen(false); setSelectedBuyingDetail(null); }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isFullScreen) return;
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'Escape') {
                if (selectedBuyingDetail) setSelectedBuyingDetail(null);
                else exitPresentation();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen, nextSlide, prevSlide, exitPresentation, selectedBuyingDetail]);

    const stats = useMemo(() => {
        const total = generalProjects.length;
        let totalPerc = 0;
        let naoIniciados = 0;
        let emAndamento = 0;
        const statusCounts: Record<string, number> = {};

        generalProjects.forEach(p => {
            const sRaw = p.status?.trim() || 'NÃO DEFINIDO';
            const sUpper = sRaw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            statusCounts[sRaw] = (statusCounts[sRaw] || 0) + 1;
            totalPerc += (p.perc || 0);
            
            if (sUpper.includes("NAO INICIADO")) {
                naoIniciados++;
            } else if (sUpper.includes("EM ANDAMENTO") || sUpper.includes("INICIADO") || (p.perc > 0 && p.perc < 100)) {
                emAndamento++;
            }
        });

        const avg = total > 0 ? (totalPerc / total).toFixed(1) : 0;

        const buCounts: Record<string, number> = {};
        generalProjects.forEach(p => { buCounts[p.bus || 'OUTROS'] = (buCounts[p.bus || 'OUTROS'] || 0) + 1; });
        const buData = Object.entries(buCounts).map(([name, value]) => ({ name, value }));

        const criticalBuys = buyingStatus.filter(b => b.status === 'Crítico');

        return { total, avg, notStarted: naoIniciados, emAndamento, statusCounts, buData, criticalBuys };
    }, [generalProjects, buyingStatus]);

    const renderSlide = () => {
        if (currentSlide === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fadeIn">
                    <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/50 transform -rotate-6">
                        <span className="text-6xl font-black text-white italic">N</span>
                    </div>
                    <div>
                        <h1 className="text-6xl font-black text-white tracking-tighter mb-4">Relatório Executivo Teleinfo</h1>
                        <p className="text-2xl text-nexus-400 font-medium">Nexus Intelligence Platform • {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="h-1 w-32 bg-blue-500 rounded-full" />
                </div>
            );
        }

        if (currentSlide === 1) {
            return (
                <div className="space-y-12 animate-fadeIn h-full flex flex-col justify-center">
                    <h2 className="text-4xl font-black text-white border-l-8 border-blue-600 pl-6 uppercase tracking-tight">Portfólio Completo</h2>
                    <div className={`grid gap-8 ${stats.notStarted > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                        <div className="bg-nexus-800/50 p-8 rounded-3xl border border-nexus-700 shadow-xl">
                            <p className="text-xs font-black text-nexus-500 uppercase tracking-widest mb-2">Total de Projetos</p>
                            <h3 className="text-7xl font-black text-white">{stats.total}</h3>
                        </div>
                        <div className="bg-nexus-800/50 p-8 rounded-3xl border border-nexus-700 shadow-xl">
                            <p className="text-xs font-black text-nexus-500 uppercase tracking-widest mb-2">Finalização Global</p>
                            <h3 className="text-7xl font-black text-blue-500">{stats.avg}%</h3>
                        </div>
                        <div className="bg-nexus-800/50 p-8 rounded-3xl border border-nexus-700 shadow-xl">
                            <p className="text-xs font-black text-nexus-500 uppercase tracking-widest mb-2">Em Andamento</p>
                            <h3 className="text-7xl font-black text-blue-500">{stats.emAndamento}</h3>
                        </div>
                        {stats.notStarted > 0 && (
                            <div className="bg-nexus-800/50 p-8 rounded-3xl border border-nexus-700 shadow-xl">
                                <p className="text-xs font-black text-nexus-500 uppercase tracking-widest mb-2">Não Iniciados</p>
                                <h3 className="text-7xl font-black text-orange-500">{stats.notStarted}</h3>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (currentSlide === 2) {
            return (
                <div className="space-y-12 animate-fadeIn h-full flex flex-col justify-center">
                    <h2 className="text-4xl font-black text-white border-l-8 border-purple-600 pl-6 uppercase tracking-tight">Distribuição por BU</h2>
                    <div className="h-[500px] w-full bg-nexus-800/30 p-8 rounded-3xl border border-nexus-700 shadow-2xl">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.buData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={14} fontWeight="bold" width={150} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40}>
                                    {stats.buData.map((e, i) => <Cell key={i} fill={getBuColor(e.name)} />)}
                                    <LabelList dataKey="value" position="right" fill="#fff" fontSize={18} fontWeight="bold" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            );
        }

        if (currentSlide === 3) {
            return (
                <div className="space-y-12 animate-fadeIn h-full flex flex-col justify-center">
                    <div className="flex justify-between items-end">
                        <h2 className="text-4xl font-black text-white border-l-8 border-red-600 pl-6 uppercase tracking-tight">Status de Compras Críticas</h2>
                        <ShoppingCart className="text-red-600 mb-2" size={48} />
                    </div>
                    <div className="bg-nexus-800/50 rounded-3xl border border-nexus-700 overflow-hidden shadow-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-nexus-900/80">
                                <tr className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">
                                    <th className="px-8 py-6">Projeto</th>
                                    <th className="px-8 py-6">Materiais Pendentes</th>
                                    <th className="px-8 py-6">Data Disponível</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-nexus-800">
                                {stats.criticalBuys.length > 0 ? (
                                    stats.criticalBuys.slice(0, 6).map((b, i) => (
                                        <tr key={i} className="hover:bg-nexus-700/20 transition-colors cursor-pointer group" onClick={() => setSelectedBuyingDetail(b)}>
                                            <td className="px-8 py-6 font-bold text-white text-lg">
                                                <div className="flex items-center gap-2">
                                                    {b.projeto} <Eye size={14} className="opacity-0 group-hover:opacity-50 text-blue-400" />
                                                </div>
                                                <span className="block text-xs font-mono text-nexus-500">{b.numeroProjeto}</span>
                                            </td>
                                            <td className="px-8 py-6 text-red-400 font-medium">{b.aComprar}</td>
                                            <td className="px-8 py-6 font-black text-white italic">{b.dataDisponivel}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-20 text-center text-nexus-500 font-bold">Nenhuma compra em estado crítico identificada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-nexus-500 font-bold uppercase text-center italic opacity-50">Clique em um projeto para ver o detalhamento completo de materiais</p>
                </div>
            );
        }

        // SLIDES DE OBRAS DETALHADAS (Slides 4 até 4 + N-1)
        if (currentSlide >= 4 && currentSlide < 4 + projectSlidesCount) {
            const project = detailedProjects[currentSlide - 4];
            const totalSold = (project.soldHours?.infra || 0) + (project.soldHours?.sse || 0) + (project.soldHours?.ti || 0);
            const totalUsed = (project.usedHours?.infra || 0) + (project.usedHours?.sse || 0) + (project.usedHours?.ti || 0);
            const hhColor = getRatioColor(totalUsed, totalSold);
            const timeProgress = calculateTimeProgress(project.start, project.end);
            const avgExec = project.steps.length > 0 ? project.steps.reduce((acc, s) => acc + s.perc, 0) / project.steps.length : 0;

            return (
                <div className="space-y-8 animate-fadeIn h-full flex flex-col justify-center">
                    <div className="flex justify-between items-start border-b border-nexus-800 pb-6">
                        <div>
                            <h2 className="text-4xl font-black text-white tracking-tight uppercase">{project.name}</h2>
                            <div className="flex gap-4 mt-2">
                                <span className="bg-nexus-800 text-nexus-400 px-3 py-1 rounded text-xs font-black border border-nexus-700">CC: {project.costCenter}</span>
                                <span className="bg-nexus-800 text-nexus-400 px-3 py-1 rounded text-xs font-black border border-nexus-700">BU: {project.bu || 'GERAL'}</span>
                                <button 
                                    onClick={() => onGenerateAiReport(project)}
                                    disabled={isGeneratingReport}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-purple-900/40 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isGeneratingReport ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
                                    Auditoria Sênior IA
                                </button>
                            </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-nexus-500 uppercase">Período de Obra</p>
                           <p className="text-lg font-bold text-white italic">{project.start || 'N/A'} — {project.end || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-nexus-800/40 p-6 rounded-2xl border border-nexus-700">
                            <p className="text-[10px] font-black text-nexus-500 uppercase mb-2">Prazo Decorrido</p>
                            <h4 className="text-4xl font-black text-white">{timeProgress}%</h4>
                            <div className="w-full bg-nexus-900 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${timeProgress}%` }} />
                            </div>
                        </div>
                        <div className="bg-nexus-800/40 p-6 rounded-2xl border border-nexus-700">
                            <p className="text-[10px] font-black text-nexus-500 uppercase mb-2">Execução Média</p>
                            <h4 className="text-4xl font-black text-green-500">{avgExec.toFixed(0)}%</h4>
                            <div className="w-full bg-nexus-900 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${avgExec}%` }} />
                            </div>
                        </div>
                        <div className="bg-nexus-800/40 p-6 rounded-2xl border border-nexus-700 col-span-2">
                            <p className="text-[10px] font-black text-nexus-500 uppercase mb-2">Consumo Global H/H</p>
                            <div className="flex justify-between items-baseline">
                                <h4 className="text-4xl font-black text-white">{totalUsed} <span className="text-xs text-nexus-500">/ {totalSold}h</span></h4>
                                <span className="text-xl font-bold" style={{ color: hhColor }}>{totalSold > 0 ? ((totalUsed/totalSold)*100).toFixed(0) : 0}%</span>
                            </div>
                            <div className="w-full bg-nexus-900 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="h-full transition-all" style={{ width: `${Math.min(100, totalSold > 0 ? (totalUsed/totalSold)*100 : 0)}%`, backgroundColor: hhColor }} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-nexus-800/20 p-8 rounded-3xl border border-nexus-700 flex-1 min-h-0">
                        <h4 className="text-xs font-black text-nexus-500 uppercase mb-6 tracking-widest flex items-center gap-2">
                           <Target size={14} className="text-blue-500" /> Detalhamento de Progresso por Fase
                        </h4>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={project.steps} margin={{ top: 35, right: 30, left: 20, bottom: 20 }}>
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="bold" />
                                    {/* Ajustado domínio do Y para dar espaço ao rótulo de 100% (Agora com 120 para garantir) */}
                                    <YAxis domain={[0, 120]} hide />
                                    <Bar dataKey="perc" radius={[8, 8, 0, 0]} barSize={50}>
                                        {project.steps.map((_, i) => <Cell key={i} fill={getBuColor(project.bu || '')} />)}
                                        <LabelList dataKey="perc" position="top" fill="#fff" fontSize={16} fontWeight="black" formatter={(v:number) => `${v}%`} offset={10} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            );
        }

        // SLIDE FINAL
        if (currentSlide === slidesCount - 1) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-12 animate-fadeIn">
                    <div className="w-32 h-32 bg-blue-600 rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)]">
                        <span className="text-7xl font-black text-white italic">N</span>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-6xl font-black text-white tracking-tighter italic">Obrigado a todos!</h2>
                        <p className="text-2xl text-nexus-400 font-medium">Equipe Teleinfo Engenharia — Tecnologia e Inteligência</p>
                        <div className="flex justify-center gap-8 mt-12">
                             <div className="flex items-center gap-2 text-nexus-500 font-bold uppercase text-xs tracking-widest border-r border-nexus-700 pr-8">
                                <Activity size={16} /> Auditoria 2025
                             </div>
                             <div className="flex items-center gap-2 text-nexus-500 font-bold uppercase text-xs tracking-widest">
                                <UserCheck size={16} /> A disposição
                             </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }

    return (
        <div className="relative">
            {/* Preview Card */}
            <div className="bg-nexus-800 p-12 rounded-3xl border border-nexus-700 shadow-2xl flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
                <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center">
                    <MonitorPlay size={40} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-white italic">Motor de Apresentação Nexus</h3>
                    <p className="text-nexus-400 max-w-sm mt-2 font-medium">Narrativa dinâmica: Capa, Portfólio, BUs, Compras Críticas, Obras Auditadas e Conclusão.</p>
                </div>
                <button 
                    onClick={() => { setIsFullScreen(true); setCurrentSlide(0); }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl shadow-blue-900/40 transition-all active:scale-95"
                >
                    <Maximize2 size={18} /> Iniciar Apresentação Executiva
                </button>
            </div>

            {/* FULL SCREEN OVERLAY */}
            {isFullScreen && (
                <div className="fixed inset-0 bg-nexus-900 z-[1000] flex flex-col overflow-hidden">
                    {/* Header Slide */}
                    <div className="h-20 border-b border-nexus-800 px-12 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white italic">N</div>
                            <span className="text-nexus-500 font-black uppercase text-xs tracking-widest">Nexus Intelligence Platform — Teleinfo Engenharia</span>
                        </div>
                        <button onClick={exitPresentation} className="text-nexus-500 hover:text-white transition-colors p-2"><X size={28} /></button>
                    </div>

                    {/* Slide Content */}
                    <div className="flex-1 px-20 py-12 relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="w-full max-w-6xl h-full">
                           {renderSlide()}
                        </div>
                    </div>

                    {/* Modal Detalhes Compras */}
                    {selectedBuyingDetail && (
                        <div className="fixed inset-0 bg-black/90 z-[1010] flex items-center justify-center p-8 backdrop-blur-xl animate-fadeIn" onClick={() => setSelectedBuyingDetail(null)}>
                            <div className="bg-nexus-800 border-2 border-red-500/50 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="bg-red-600 p-6 flex justify-between items-center text-white">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle size={32} />
                                        <div>
                                            <h3 className="font-black text-2xl uppercase italic">Analise de Criticidade</h3>
                                            <p className="text-xs font-bold text-white/70 uppercase">Detalhes da Cadeia de Suprimentos</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedBuyingDetail(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={32}/></button>
                                </div>
                                <div className="p-10 space-y-6">
                                    <div>
                                        <label className="text-xs font-black text-nexus-500 uppercase tracking-widest">Projeto</label>
                                        <h4 className="text-3xl font-black text-white mt-1">{selectedBuyingDetail.projeto}</h4>
                                        <p className="text-nexus-400 font-mono text-lg tracking-tighter">ID: {selectedBuyingDetail.numeroProjeto}</p>
                                    </div>
                                    <div className="bg-nexus-900 p-6 rounded-2xl border border-nexus-700">
                                        <label className="text-xs font-black text-red-500 uppercase flex items-center gap-2"><ShoppingCart size={14} /> Materiais a Comprar</label>
                                        <p className="text-white text-xl mt-3 font-medium">{selectedBuyingDetail.aComprar}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-nexus-900 p-4 rounded-xl border border-nexus-700">
                                            <label className="text-xs font-black text-nexus-500 uppercase tracking-widest">Comprados</label>
                                            <p className="text-nexus-300 text-lg font-bold">{selectedBuyingDetail.comprados}</p>
                                        </div>
                                        <div className="bg-nexus-900 p-4 rounded-xl border border-nexus-700">
                                            <label className="text-xs font-black text-nexus-500 uppercase tracking-widest">Entregues</label>
                                            <p className="text-nexus-300 text-lg font-bold">{selectedBuyingDetail.entregue}</p>
                                        </div>
                                    </div>
                                    <div className="bg-blue-600/10 p-6 rounded-xl border border-blue-500/20">
                                        <label className="text-xs font-black text-blue-400 uppercase">Data Disponível</label>
                                        <p className="text-white text-3xl font-black italic">{selectedBuyingDetail.dataDisponivel}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Slide */}
                    <div className="h-24 border-t border-nexus-800 px-12 flex items-center justify-between">
                        <div className="flex gap-2">
                            <button onClick={prevSlide} className="p-4 bg-nexus-800 hover:bg-nexus-700 text-white rounded-full transition-all active:scale-90"><ChevronLeft size={24} /></button>
                            <button onClick={nextSlide} className="p-4 bg-nexus-800 hover:bg-nexus-700 text-white rounded-full transition-all active:scale-90"><ChevronRight size={24} /></button>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-white font-black text-xl italic">{currentSlide + 1} / {slidesCount}</span>
                            <div className="w-48 h-1 bg-nexus-800 mt-2 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((currentSlide + 1) / slidesCount) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const KeyboardArrowIcon = () => (
    <div className="flex gap-0.5">
        <div className="w-4 h-4 border border-nexus-500 rounded flex items-center justify-center"><ChevronLeft size={10}/></div>
        <div className="w-4 h-4 border border-nexus-500 rounded flex items-center justify-center"><ChevronRight size={10}/></div>
    </div>
);

const EscapeIcon = () => (
    <div className="px-1 border border-nexus-500 rounded text-[8px] flex items-center justify-center">ESC</div>
);

export const TeleinfoReport: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'presentation'>('dashboard');
    const [generalProjects] = useSupabaseData<any[]>('general_projects', []);
    const [detailedProjects] = useSupabaseData<DetailedProject[]>('detailed_projects', []);
    const [buyingStatus] = useSupabaseData<ProjectBuyingStatus[]>('buying_status', []);

    // AI Report State moved to parent
    const [aiReport, setAiReport] = useState<{ content: string; projectName: string } | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const handleGenerateAiReport = async (project: DetailedProject) => {
        setIsGeneratingReport(true);
        try {
            const report = await generateSeniorPlanningAuditReport(project);
            setAiReport({ content: report, projectName: project.name });
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar relatório de auditoria.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleExportReport = () => {
        if (!aiReport) return;
        const blob = new Blob([aiReport.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_Auditoria_${aiReport.projectName.replace(/\s+/g, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Relatórios & Auditoria IA</h2>
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
                {activeTab === 'monitoring' && (
                    <MonitoringView 
                        onGenerateAiReport={handleGenerateAiReport}
                        isGeneratingReport={isGeneratingReport}
                    />
                )}
                {activeTab === 'presentation' && (
                    <PresentationView 
                        generalProjects={generalProjects} 
                        detailedProjects={detailedProjects} 
                        buyingStatus={buyingStatus}
                        onGenerateAiReport={handleGenerateAiReport}
                        isGeneratingReport={isGeneratingReport}
                    />
                )}
            </div>

            {/* AI Report Modal - Now in Parent */}
            {aiReport && (
                <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-4 md:p-8 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-nexus-800 border border-nexus-700 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                        <div className="bg-purple-600 p-6 flex justify-between items-center text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <BrainCircuit size={32} />
                                <div>
                                    <h3 className="font-black text-xl uppercase italic">Auditoria Sênior IA</h3>
                                    <p className="text-xs font-bold text-white/70 uppercase tracking-widest">{aiReport.projectName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleExportReport}
                                    className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase"
                                    title="Exportar Relatório (.md)"
                                >
                                    <Download size={18} />
                                    <span className="hidden sm:inline">Exportar</span>
                                </button>
                                <button onClick={() => setAiReport(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={24}/></button>
                            </div>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar bg-nexus-900/50">
                            <div className="prose prose-invert max-w-none 
                                prose-headings:text-white prose-headings:border-b prose-headings:border-nexus-700 prose-headings:pb-2 prose-headings:mt-8 first:prose-headings:mt-0
                                prose-p:text-nexus-300 prose-p:leading-relaxed
                                prose-strong:text-purple-400 prose-strong:font-black
                                prose-ul:text-nexus-300 prose-li:my-2
                                prose-hr:border-nexus-700">
                                <Markdown>{aiReport.content}</Markdown>
                            </div>
                        </div>
                        <div className="p-6 border-t border-nexus-700 flex justify-end bg-nexus-800 shrink-0">
                            <button onClick={() => setAiReport(null)} className="bg-nexus-700 hover:bg-nexus-600 text-white px-8 py-2 rounded-xl font-bold transition-all">Fechar Relatório</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
