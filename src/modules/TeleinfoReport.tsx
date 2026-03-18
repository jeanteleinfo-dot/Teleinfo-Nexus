
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, PieChart, Pie
} from 'recharts';
import { 
  UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare, 
  Save, FilePlus, Trash2, Plus, Download, LayoutDashboard, Target, CheckCircle2, Activity,
  Layers, Clock, ClipboardList, Calendar, Briefcase, ListTodo, Percent, Timer, TrendingUp,
  History, ChevronLeft, ChevronRight, Maximize2, MonitorPlay, ShoppingCart, UserCheck, Eye,
  FileSearch, Loader2, Package, CheckCircle, Info, RefreshCw, Rocket, DollarSign,
  FolderArchive, CheckSquare, Key
} from 'lucide-react';
import Markdown from 'react-markdown';
import Papa from 'papaparse';
import { DetailedProject, DetailedProjectStep, BuHours, ProjectBuyingStatus } from '../types';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

import { supabase, syncToSupabase, fetchFromSupabase, useSupabaseData } from '../services/supabase';
import { generateSeniorPlanningAuditReport, generateLessonsLearnedReport } from '../services/geminiService';

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
    const results = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";",
        transformHeader: (header) => header.trim().replace(/^\ufeff/i, "").toUpperCase(),
    });

    return results.data.map((item: any, idx) => {
        const percRaw = (item['%'] || "").toString().replace('%', '').replace(',', '.').trim();
        return {
            id: `gen-${item.ITEM || idx}-${Date.now()}`,
            item: item.ITEM || "",
            cliente: item.CLIENTE || "",
            tipoProjeto: item['TIPO DE PROJETO'] || "",
            tipoProduto: item['TIPO DE PRODUTO'] || "",
            squadLeader: item['SQUAD LEADER'] || "",
            bus: item.BUS || item.BUs || "",
            cCusto: item['C.CUSTO'] || item['C.Custo'] || "",
            escopo: item.ESCOPO || "",
            status: item.STATUS || "",
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
            totalPerc += (p.perc || 0);
            
            if (sUpper.includes("NAO INICIADO")) {
                naoIniciados++;
            } else if (sUpper.includes("EM ANDAMENTO") || sUpper.includes("INICIADO") || (p.perc > 0 && p.perc < 100)) {
                emAndamento++;
            }
        });
        return {
            statusCounts: counts,
            avgCompletion: projects.length > 0 ? (totalPerc / projects.length).toFixed(1) : "0.0",
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
            const text = evt.target?.result as string;
            const parsed = parseGeneralCsv(text);
            
            if (parsed.length === 0) {
                alert("Nenhum dado encontrado no arquivo CSV.");
                return;
            }

            try {
                // Delete existing records first to avoid duplicates with new IDs
                const { error: deleteError } = await supabase.from('general_projects').delete().neq('id', '0');
                
                if (deleteError) {
                    console.error("Erro ao limpar dados antigos:", deleteError);
                }
                
                // Update local state which triggers syncToSupabase (upsert)
                setProjects(parsed);
                alert(`${parsed.length} projetos importados com sucesso!`);
            } catch (err) {
                console.error("Erro na importação:", err);
                alert("Erro ao importar dados.");
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
    projects: DetailedProject[];
    setProjects: React.Dispatch<React.SetStateAction<DetailedProject[]>>;
    onGenerateAiReport: (project: DetailedProject) => void;
    isGeneratingReport: boolean;
}

const MonitoringView: React.FC<MonitoringProps> = ({ projects, setProjects, onGenerateAiReport, isGeneratingReport }) => {
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [editingProject, setEditingProject] = useState<DetailedProject | null>(null);
    const [tempStepName, setTempStepName] = useState('');
    const [tempStepPerc, setTempStepPerc] = useState<number>(0);

    const activeProjects = projects.filter(p => p.status !== 'archived');

    const handleSave = async () => {
        if (!editingProject || !editingProject.name) {
            alert("O nome do projeto é obrigatório.");
            return;
        }
        
        // Garante um ID único se for novo projeto
        const isNew = !editingProject.id;
        const finalId = editingProject.id || `proj-det-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        const projectToSave = { 
            ...editingProject, 
            id: finalId,
            updated_at: new Date().toISOString() 
        };

        console.log("[Monitoring] Iniciando salvamento do projeto:", projectToSave);

        const updated = isNew 
            ? [...projects, projectToSave]
            : projects.map(p => p.id === finalId ? projectToSave : p);
        
        try {
            setProjects(updated);
            
            // Forçamos uma pequena espera para o estado atualizar e o hook de sync ser chamado
            console.log("[Monitoring] Estado local atualizado. Aguardando confirmação do banco...");
            
            setViewMode('list');
            setEditingProject(null);
            
            // Feedback visual imediato
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-10 right-10 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl z-[5000] animate-bounce font-bold';
            toast.innerText = '✓ Projeto salvo e sincronizando...';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

        } catch (err) {
            console.error("[Monitoring] Erro ao salvar:", err);
            alert("Erro ao processar salvamento. Verifique o console para detalhes.");
        }
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
                        setEditingProject({ 
                            id: '', name: '', bu: '', start: '', end: '', costCenter: '', 
                            steps: [], 
                            soldHours: {infra:0,sse:0,ti:0,aut:0}, 
                            usedHours: {infra:0,sse:0,ti:0,aut:0}, 
                            observations: '',
                            totalSoldValue: 0,
                            totalCostValue: 0,
                            totalUsedValue: 0,
                            status: 'active'
                        }); 
                        setViewMode('form'); 
                    }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-blue-900/40 active:scale-95 transition-all">
                        <Plus size={18} /> Novo Projeto
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeProjects.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-nexus-800 rounded-xl border-2 border-dashed border-nexus-700 text-nexus-500">
                        <GanttChartSquare size={40} className="mx-auto mb-2 opacity-20" />
                        Nenhuma auditoria cadastrada.
                    </div>
                  ) : (
                    activeProjects.map(p => {
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
                                        <h4 className="text-white font-bold text-lg flex items-center gap-2">
                                            {p.name}
                                            {p.observations && <Info size={14} className="text-blue-400 opacity-70" />}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-nexus-900 text-nexus-400 border border-nexus-700">CC: {p.costCenter}</span>
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border" style={{ borderColor: getBuColor(p.bu || ''), color: getBuColor(p.bu || '') }}>{p.bu || 'GERAL'}</span>
                                            {p.totalCostValue && p.totalCostValue > 0 && (
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                                    (p.totalUsedValue || 0) / p.totalCostValue > 1.0 ? 'border-red-500 text-red-500 bg-red-500/10' :
                                                    (p.totalUsedValue || 0) / p.totalCostValue > 0.8 ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                                                    'border-green-500 text-green-500 bg-green-500/10'
                                                }`}>
                                                    Saúde: {(p.totalUsedValue || 0) / p.totalCostValue > 1.0 ? 'Crítica' : (p.totalUsedValue || 0) / p.totalCostValue > 0.8 ? 'Atenção' : 'Saudável'}
                                                </span>
                                            )}
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
                                        <button onClick={() => { setEditingProject(p); setViewMode('form'); }} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Editar Auditoria"><GanttChartSquare size={16}/></button>
                                        <button 
                                            onClick={() => { 
                                                if(confirm(`Arquivar obra ${p.name}? Ela será movida para Lições Aprendidas.`)) {
                                                    setProjects(projects.map(x => x.id === p.id ? { ...x, status: 'archived' } : x));
                                                }
                                            }} 
                                            className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                                            title="Arquivar Obra (Finalizada)"
                                        >
                                            <FolderArchive size={16}/>
                                        </button>
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
                        <div className="space-y-1">
                            <label className="text-xs text-nexus-500 font-bold uppercase">Observações para Auditoria IA</label>
                            <textarea 
                                placeholder="Descreva detalhes relevantes, atrasos, justificativas ou pontos de atenção para a IA analisar..." 
                                value={editingProject?.observations || ''} 
                                onChange={e => setEditingProject({...editingProject!, observations: e.target.value})} 
                                rows={4}
                                className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all resize-none text-sm"
                            />
                        </div>

                        <div className="pt-4 border-t border-nexus-700 space-y-4">
                            <h4 className="text-nexus-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <DollarSign size={14}/> Gestão Financeira (Valores)
                            </h4>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-nexus-500 font-bold uppercase">Valor Total Vendido (Receita)</label>
                                    <input type="number" value={editingProject?.totalSoldValue || 0} 
                                           onChange={e => setEditingProject({...editingProject!, totalSoldValue: Number(e.target.value)})} 
                                           className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-nexus-500 font-bold uppercase">Valor de Custo (Orçamento)</label>
                                    <input type="number" value={editingProject?.totalCostValue || 0} 
                                           onChange={e => setEditingProject({...editingProject!, totalCostValue: Number(e.target.value)})} 
                                           className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-nexus-500 font-bold uppercase">Valor Utilizado (Realizado)</label>
                                    <input type="number" value={editingProject?.totalUsedValue || 0} 
                                           onChange={e => setEditingProject({...editingProject!, totalUsedValue: Number(e.target.value)})} 
                                           className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none" />
                                </div>
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

const BuyingDetailModal: React.FC<{ project: ProjectBuyingStatus; onClose: () => void }> = ({ project, onClose }) => {
    const isCritico = project.status === 'Crítico';
    const isIntermediario = project.status === 'Intermediário';
    
    // Mapeamento explícito de cores para evitar problemas com interpolação do Tailwind
    const colorConfig = isCritico 
        ? { border: 'border-red-500', bg: 'bg-red-600', text: 'text-red-400', icon: AlertTriangle, shadow: 'shadow-[0_0_80px_rgba(239,68,68,0.4)]' }
        : isIntermediario 
        ? { border: 'border-yellow-500', bg: 'bg-yellow-600', text: 'text-yellow-400', icon: Clock, shadow: 'shadow-[0_0_80px_rgba(234,179,8,0.3)]' }
        : { border: 'border-green-500', bg: 'bg-green-600', text: 'text-green-400', icon: CheckCircle, shadow: 'shadow-[0_0_80px_rgba(34,197,94,0.3)]' };

    const Icon = colorConfig.icon;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1100] p-4 backdrop-blur-lg animate-fadeIn" onClick={onClose}>
            <div className={`bg-nexus-900 border-2 ${colorConfig.border} rounded-2xl w-full max-w-4xl ${colorConfig.shadow} animate-slideUp overflow-hidden flex flex-col max-h-[85vh]`} onClick={e => e.stopPropagation()}>
                <div className={`${colorConfig.bg} p-4 md:p-5 flex justify-between items-center shrink-0`}>
                    <div className="flex items-center gap-4 text-white">
                        <div className="bg-white/20 p-2.5 rounded-xl shadow-inner">
                            <Icon size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-xl uppercase tracking-tighter leading-none">Análise Crítica de Suprimentos</h3>
                            <p className="text-white/90 text-[9px] font-black uppercase tracking-[0.3em] mt-1">Nexus Intelligence • Status: {project.status}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all active:scale-90"><X size={24}/></button>
                </div>
                
                <div className="p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar bg-nexus-900/50 flex-1">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-3">
                            <label className="text-[9px] uppercase font-black text-nexus-500 tracking-[0.3em] block">Título do Projeto</label>
                            <p className="text-3xl font-black text-white leading-tight tracking-tighter uppercase">{project.projeto}</p>
                        </div>
                        <div className="space-y-4 bg-nexus-800/40 p-5 rounded-2xl border border-nexus-700 shadow-inner">
                            <div>
                                <label className="text-[9px] uppercase font-black text-nexus-500 tracking-[0.2em] mb-1.5 block">Nº CC / Identificador</label>
                                <p className="text-xl text-white font-mono font-black bg-nexus-900 px-3 py-1.5 rounded-lg border border-nexus-700 inline-block shadow-lg">{project.numeroProjeto}</p>
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-black text-nexus-500 tracking-[0.2em] mb-1.5 block">Previsão de Disponibilidade</label>
                                <p className={`text-xl font-black italic flex items-center gap-2 ${project.dataDisponivel === 'A definir' ? 'text-red-500' : 'text-green-500'}`}>
                                    <Calendar size={18} /> {project.dataDisponivel}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-nexus-800/60 p-6 rounded-2xl border border-nexus-700 shadow-lg relative">
                            <div className="absolute top-0 left-6 -translate-y-1/2 bg-nexus-900 px-4 py-1.5 border border-nexus-700 rounded-full flex items-center gap-2 shadow-md">
                                <ShoppingCart size={14} className={colorConfig.text} />
                                <label className="text-[9px] uppercase font-black text-nexus-400 tracking-[0.2em]">Materiais Pendentes / A Comprar</label>
                            </div>
                            <p className={`text-xl font-bold whitespace-pre-wrap leading-relaxed ${isCritico ? 'text-red-400' : 'text-white'} pt-3`}>{project.aComprar || 'Nenhum material pendente mapeado.'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-nexus-800/40 p-6 rounded-2xl border border-nexus-700 hover:border-nexus-600 transition-all shadow-md">
                            <label className="text-[9px] uppercase font-black text-nexus-500 tracking-[0.2em] mb-3 block">Fluxo de Compras (Já Adquirido)</label>
                            <p className="text-white text-lg font-medium whitespace-pre-wrap leading-relaxed opacity-90">{project.comprados || 'Informação não disponível.'}</p>
                        </div>
                        <div className="bg-nexus-800/40 p-6 rounded-2xl border border-nexus-700 hover:border-nexus-600 transition-all shadow-md">
                            <label className="text-[9px] uppercase font-black text-nexus-500 tracking-[0.2em] mb-3 block">Logística (Entregues na Obra)</label>
                            <p className="text-white text-lg font-medium whitespace-pre-wrap leading-relaxed opacity-90">{project.entregue || 'Aguardando confirmação logística.'}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-nexus-900 p-6 border-t border-nexus-700 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-8 py-3 bg-nexus-700 hover:bg-nexus-600 text-white rounded-full transition-all font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-3">
                        <X size={16} /> Fechar Análise
                    </button>
                </div>
            </div>
        </div>
    );
};

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
        let finalizados = 0;
        let kickoff = 0;
        const kickoffProjects: any[] = [];
        const statusCounts: Record<string, number> = {};

        generalProjects.forEach(p => {
            const sRaw = p.status?.trim() || 'NÃO DEFINIDO';
            const sUpper = sRaw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            statusCounts[sRaw] = (statusCounts[sRaw] || 0) + 1;
            totalPerc += (p.perc || 0);
            
            if (sUpper.includes("NAO INICIADO")) {
                naoIniciados++;
            } else if (sUpper.includes("KICKOFF")) {
                kickoff++;
                kickoffProjects.push(p);
            } else if (sUpper.includes("FINALIZADO") || p.perc === 100) {
                finalizados++;
            } else if (sUpper.includes("EM ANDAMENTO") || sUpper.includes("INICIADO") || (p.perc > 0 && p.perc < 100)) {
                emAndamento++;
            }
        });

        const avg = total > 0 ? (totalPerc / total).toFixed(1) : 0;

        const buCounts: Record<string, number> = {};
        generalProjects.forEach(p => { buCounts[p.bus || 'OUTROS'] = (buCounts[p.bus || 'OUTROS'] || 0) + 1; });
        const buData = Object.entries(buCounts).map(([name, value]) => ({ name, value }));

        const criticalBuys = buyingStatus.filter(b => b.status === 'Crítico');
        const intermediateBuys = buyingStatus.filter(b => b.status === 'Intermediário');
        const standardBuys = buyingStatus.filter(b => b.status === 'Padrão');

        return { 
            total, 
            avg, 
            notStarted: naoIniciados, 
            emAndamento, 
            finalizados,
            kickoff,
            kickoffProjects,
            statusCounts, 
            buData, 
            criticalBuys,
            intermediateBuys,
            standardBuys,
            buyingTotal: buyingStatus.length
        };
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
                <div className="space-y-6 animate-fadeIn h-full flex flex-col justify-start py-2 overflow-hidden">
                    <h2 className="text-2xl font-black text-white border-l-6 border-blue-600 pl-4 uppercase tracking-tight mb-2">Portfólio Completo</h2>
                    
                    <div className="grid grid-cols-6 gap-3 shrink-0">
                        {/* Total de Projetos */}
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700/50 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:bg-nexus-800/60 transition-all">
                            <div>
                                <p className="text-[9px] font-black text-nexus-400 uppercase tracking-[0.2em] mb-1">Total de Projetos</p>
                                <h3 className="text-4xl font-black text-white mt-1">{stats.total}</h3>
                            </div>
                            <Layers className="absolute right-4 bottom-4 text-nexus-700 group-hover:text-nexus-500 transition-colors" size={24} />
                        </div>

                        {/* Finalização Global */}
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700/50 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:bg-nexus-800/60 transition-all">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-[9px] font-black text-nexus-400 uppercase tracking-[0.2em]">Finalização Global</p>
                                    <Target className="text-blue-500" size={14} />
                                </div>
                                <h3 className="text-2xl font-black text-white mt-1">{stats.avg}%</h3>
                            </div>
                            <div className="w-full bg-nexus-900 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                    style={{ width: `${stats.avg}%` }}
                                />
                            </div>
                        </div>

                        {/* Não Iniciados */}
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700/50 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:bg-nexus-800/60 transition-all">
                            <div>
                                <p className="text-[9px] font-black text-nexus-400 uppercase tracking-[0.2em] mb-1">Não Iniciados</p>
                                <h3 className="text-4xl font-black text-red-500 mt-1">{stats.notStarted}</h3>
                            </div>
                            <Clock className="absolute right-4 bottom-4 text-red-900/40 group-hover:text-red-500/40 transition-colors" size={24} />
                        </div>

                        {/* Kickoff */}
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700/50 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:bg-nexus-800/60 transition-all">
                            <div>
                                <p className="text-[9px] font-black text-nexus-400 uppercase tracking-[0.2em] mb-1">Kickoff</p>
                                <h3 className="text-4xl font-black text-purple-500 mt-1">{stats.kickoff}</h3>
                            </div>
                            <Rocket className="absolute right-4 bottom-4 text-purple-900/40 group-hover:text-purple-500/40 transition-colors" size={24} />
                        </div>

                        {/* Em Andamento */}
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700/50 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:bg-nexus-800/60 transition-all">
                            <div>
                                <p className="text-[9px] font-black text-nexus-400 uppercase tracking-[0.2em] mb-1">Em Andamento</p>
                                <h3 className="text-4xl font-black text-blue-400 mt-1">{stats.emAndamento}</h3>
                            </div>
                            <Activity className="absolute right-4 bottom-4 text-blue-900/40 group-hover:text-blue-400/40 transition-colors" size={24} />
                        </div>

                        {/* Finalizado */}
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700/50 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden group hover:bg-nexus-800/60 transition-all">
                            <div>
                                <p className="text-[9px] font-black text-nexus-400 uppercase tracking-[0.2em] mb-1">Finalizado</p>
                                <h3 className="text-4xl font-black text-green-500 mt-1">{stats.finalizados}</h3>
                            </div>
                            <CheckCircle2 className="absolute right-4 bottom-4 text-green-900/40 group-hover:text-green-500/40 transition-colors" size={24} />
                        </div>
                    </div>

                    {/* Lista de Obras em Kickoff */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-nexus-800/20 rounded-2xl border border-nexus-700/30">
                        <div className="p-3 border-b border-nexus-700/50 bg-nexus-800/40 flex items-center justify-between">
                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Rocket size={14} className="text-purple-500" /> Detalhamento: Obras em Kickoff
                            </h4>
                            <span className="text-[10px] font-bold text-nexus-400 bg-nexus-900 px-2 py-0.5 rounded-full">
                                {stats.kickoff} Projetos
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-nexus-700">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-nexus-900 z-10">
                                    <tr className="border-b border-nexus-700">
                                        <th className="p-3 text-[9px] font-black text-nexus-500 uppercase tracking-widest">Cliente</th>
                                        <th className="p-3 text-[9px] font-black text-nexus-500 uppercase tracking-widest">Squad Leader</th>
                                        <th className="p-3 text-[9px] font-black text-nexus-500 uppercase tracking-widest">C. Custo</th>
                                        <th className="p-3 text-[9px] font-black text-nexus-500 uppercase tracking-widest">Escopo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-nexus-800/50">
                                    {stats.kickoffProjects.length > 0 ? (
                                        stats.kickoffProjects.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-nexus-700/20 transition-colors group">
                                                <td className="p-3 text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{p.cliente}</td>
                                                <td className="p-3 text-xs font-medium text-nexus-300 italic">{p.squadLeader}</td>
                                                <td className="p-3 text-xs font-mono text-nexus-400">{p.cCusto}</td>
                                                <td className="p-3 text-xs text-nexus-400 max-w-xs truncate" title={p.escopo}>{p.escopo}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="p-10 text-center text-nexus-500 italic text-sm">Nenhum projeto em fase de Kickoff identificado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                <div className="h-full flex flex-col space-y-2 p-1 max-h-full overflow-hidden">
                    <div className="flex justify-between items-center border-b border-nexus-800 pb-2">
                        <div className="space-y-0">
                            <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[8px]">Suprimentos & Logística</p>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Status de Compras</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-nexus-800/50 px-3 py-1 rounded-lg border border-nexus-700">
                            <ShoppingCart className="text-blue-500" size={18} />
                            <div className="text-right">
                                <p className="text-[7px] font-black text-nexus-500 uppercase tracking-widest">Total Mapeado</p>
                                <p className="text-sm font-black text-white leading-none">{stats.buyingTotal} Projetos</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {/* Padrão */}
                        <div className="bg-nexus-800/40 p-3 rounded-xl border border-nexus-700 shadow-lg relative overflow-hidden group hover:border-green-500/50 transition-all">
                            <div className="absolute top-2 right-2 w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center border border-green-500/30">
                                <CheckCircle className="text-green-500" size={16} />
                            </div>
                            <p className="text-[8px] font-black text-nexus-500 uppercase tracking-widest mb-0.5">Padrão</p>
                            <h3 className="text-2xl font-black text-green-500 tracking-tighter">{stats.standardBuys.length}</h3>
                            <div className="mt-1 h-1 w-full bg-nexus-900 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${(stats.standardBuys.length / stats.buyingTotal) * 100}%` }}></div>
                            </div>
                        </div>

                        {/* Intermediário */}
                        <div className="bg-nexus-800/40 p-3 rounded-xl border border-nexus-700 shadow-lg relative overflow-hidden group hover:border-yellow-500/50 transition-all">
                            <div className="absolute top-2 right-2 w-8 h-8 bg-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                                <Clock className="text-yellow-500" size={16} />
                            </div>
                            <p className="text-[8px] font-black text-nexus-500 uppercase tracking-widest mb-0.5">Intermediário</p>
                            <h3 className="text-2xl font-black text-yellow-500 tracking-tighter">{stats.intermediateBuys.length}</h3>
                            <div className="mt-1 h-1 w-full bg-nexus-900 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500" style={{ width: `${(stats.intermediateBuys.length / stats.buyingTotal) * 100}%` }}></div>
                            </div>
                        </div>

                        {/* Crítico */}
                        <div className="bg-nexus-800/40 p-3 rounded-xl border border-nexus-700 shadow-lg relative overflow-hidden group hover:border-red-500/50 transition-all">
                            <div className="absolute top-2 right-2 w-8 h-8 bg-red-600/20 rounded-lg flex items-center justify-center border border-red-500/30">
                                <AlertTriangle className="text-red-500" size={16} />
                            </div>
                            <p className="text-[8px] font-black text-nexus-500 uppercase tracking-widest mb-0.5">Crítico</p>
                            <h3 className="text-2xl font-black text-red-500 tracking-tighter">{stats.criticalBuys.length}</h3>
                            <div className="mt-1 h-1 w-full bg-nexus-900 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500" style={{ width: `${(stats.criticalBuys.length / stats.buyingTotal) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-nexus-800/40 rounded-xl border border-nexus-700 overflow-hidden shadow-2xl flex-1 flex flex-col relative min-h-0">
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-nexus-900/95 sticky top-0 z-30">
                                    <tr className="text-[8px] font-black text-nexus-500 uppercase tracking-[0.1em]">
                                        <th className="px-4 py-2">Projeto / Cliente</th>
                                        <th className="px-4 py-2">CC</th>
                                        <th className="px-4 py-2 text-center">Status</th>
                                        <th className="px-4 py-2">Pendências</th>
                                        <th className="px-4 py-2 text-right">Disponibilidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-nexus-700/30">
                                    {buyingStatus.length > 0 ? (
                                        buyingStatus.map((b, i) => {
                                            const isCritico = b.status === 'Crítico';
                                            const isIntermediario = b.status === 'Intermediário';
                                            const colorClass = isCritico ? 'text-red-400' : isIntermediario ? 'text-yellow-400' : 'text-green-400';
                                            const badgeClass = isCritico ? 'bg-red-600/20 text-red-400 border-red-500/30' : isIntermediario ? 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30' : 'bg-green-600/20 text-green-400 border-green-500/30';
                                            const dateColor = b.dataDisponivel === 'A definir' ? 'text-red-400' : 'text-green-400';

                                            return (
                                                <tr 
                                                    key={i} 
                                                    className="hover:bg-nexus-700/40 transition-all cursor-pointer group border-l-2 border-transparent hover:border-blue-500" 
                                                    onClick={() => setSelectedBuyingDetail(b)}
                                                >
                                                    <td className="px-4 py-1.5">
                                                        <p className={`font-black text-xs uppercase tracking-tight ${colorClass} group-hover:translate-x-1 transition-transform truncate max-w-[200px]`}>
                                                            {b.projeto}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-1.5">
                                                        <span className="font-mono font-black text-[9px] text-nexus-400">{b.numeroProjeto}</span>
                                                    </td>
                                                    <td className="px-4 py-1.5 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${badgeClass}`}>
                                                            {b.status}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-1.5 font-bold text-[10px] ${colorClass} opacity-80 italic max-w-[250px] truncate`}>
                                                        {b.aComprar || 'Nenhum pendente'}
                                                    </td>
                                                    <td className={`px-4 py-1.5 font-black text-right text-xs italic ${dateColor}`}>
                                                        {b.dataDisponivel}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-nexus-500 font-black uppercase tracking-widest opacity-50 italic text-[10px]">Nenhum dado identificado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
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

            // Lógica de Saúde Financeira
            const costValue = project.totalCostValue || 0;
            const usedValue = project.totalUsedValue || 0;
            const financialRatio = costValue > 0 ? usedValue / costValue : 0;
            
            let healthStatus = 'Saudável';
            let healthColor = 'text-green-500';
            let healthBg = 'bg-green-500/20';
            let healthBorder = 'border-green-500/40';
            let HealthIcon = CheckCircle;

            if (financialRatio > 1.0) {
                healthStatus = 'Crítico';
                healthColor = 'text-red-500';
                healthBg = 'bg-red-500/20';
                healthBorder = 'border-red-500/40';
                HealthIcon = AlertTriangle;
            } else if (financialRatio > 0.8) {
                healthStatus = 'Exige Atenção';
                healthColor = 'text-yellow-500';
                healthBg = 'bg-yellow-500/20';
                healthBorder = 'border-yellow-500/40';
                HealthIcon = Clock;
            }

            return (
                <div className="space-y-4 animate-fadeIn h-full flex flex-col justify-center max-h-full overflow-hidden">
                    <div className="flex justify-between items-start border-b border-nexus-800 pb-4">
                        <div className="flex items-start gap-4">
                            <div className={`mt-1 p-2 rounded-xl border ${healthBorder} ${healthBg} ${healthColor} shadow-lg`}>
                                <HealthIcon size={24} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight uppercase">{project.name}</h2>
                                <div className="flex gap-2 mt-1">
                                    <span className="bg-nexus-800 text-nexus-400 px-2 py-0.5 rounded text-[10px] font-black border border-nexus-700">CC: {project.costCenter}</span>
                                    <span className="bg-nexus-800 text-nexus-400 px-2 py-0.5 rounded text-[10px] font-black border border-nexus-700">BU: {project.bu || 'GERAL'}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${healthBorder} ${healthBg} ${healthColor} uppercase tracking-widest`}>
                                        Saúde: {healthStatus}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] font-black text-nexus-500 uppercase">Período de Obra</p>
                           <p className="text-base font-bold text-white italic">{project.start || 'N/A'} — {project.end || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700">
                            <p className="text-[9px] font-black text-nexus-500 uppercase mb-1">Prazo Decorrido</p>
                            <h4 className="text-2xl font-black text-white">{timeProgress}%</h4>
                            <div className="w-full bg-nexus-900 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${timeProgress}%` }} />
                            </div>
                        </div>
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700">
                            <p className="text-[9px] font-black text-nexus-500 uppercase mb-1">Execução Média</p>
                            <h4 className="text-2xl font-black text-green-500">{avgExec.toFixed(0)}%</h4>
                            <div className="w-full bg-nexus-900 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${avgExec}%` }} />
                            </div>
                        </div>
                        <div className="bg-nexus-800/40 p-4 rounded-xl border border-nexus-700 col-span-2">
                            <p className="text-[9px] font-black text-nexus-500 uppercase mb-1">Consumo Global H/H</p>
                            <div className="flex justify-between items-baseline">
                                <h4 className="text-2xl font-black text-white">{totalUsed} <span className="text-[10px] text-nexus-500">/ {totalSold}h</span></h4>
                                <span className="text-lg font-bold" style={{ color: hhColor }}>{totalSold > 0 ? ((totalUsed/totalSold)*100).toFixed(0) : 0}%</span>
                            </div>
                            <div className="w-full bg-nexus-900 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="h-full transition-all" style={{ width: `${Math.min(100, totalSold > 0 ? (totalUsed/totalSold)*100 : 0)}%`, backgroundColor: hhColor }} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-nexus-800/20 p-4 rounded-2xl border border-nexus-700 flex-1 min-h-0 overflow-hidden flex flex-col">
                        <h4 className="text-[10px] font-black text-nexus-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                           <Target size={12} className="text-blue-500" /> Detalhamento de Progresso por Fase
                        </h4>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={project.steps} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} fontWeight="bold" />
                                    <YAxis domain={[0, 120]} hide />
                                    <Bar dataKey="perc" radius={[4, 4, 0, 0]} barSize={40}>
                                        {project.steps.map((_, i) => <Cell key={i} fill={getBuColor(project.bu || '')} />)}
                                        <LabelList dataKey="perc" position="top" fill="#fff" fontSize={12} fontWeight="black" formatter={(v:number) => `${v}%`} offset={5} />
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
                <div className="fixed inset-0 bg-nexus-900 z-[1000] flex flex-col overflow-hidden p-1 md:p-2">
                    {/* Header Slide */}
                    <div className="h-10 border-b border-nexus-800 px-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-black text-white italic text-xs">N</div>
                            <span className="text-nexus-500 font-black uppercase text-[8px] tracking-widest">Nexus Intelligence Platform</span>
                        </div>
                        <button onClick={exitPresentation} className="text-nexus-500 hover:text-white transition-colors p-1"><X size={16} /></button>
                    </div>

                    {/* Slide Content */}
                    <div className="flex-1 px-1 py-1 relative overflow-hidden flex flex-col items-center justify-center min-h-0">
                        <div className="w-full max-w-6xl h-full overflow-hidden">
                           {renderSlide()}
                        </div>
                    </div>

                    {/* Modal Detalhes Compras */}
                    {selectedBuyingDetail && (
                        <BuyingDetailModal 
                            project={selectedBuyingDetail} 
                            onClose={() => setSelectedBuyingDetail(null)} 
                        />
                    )}

                    {/* Footer Slide */}
                    <div className="h-12 border-t border-nexus-800 px-4 flex items-center justify-between shrink-0">
                        <div className="flex gap-2">
                            <button onClick={prevSlide} className="p-2 bg-nexus-800 hover:bg-nexus-700 text-white rounded-full transition-all active:scale-90"><ChevronLeft size={16} /></button>
                            <button onClick={nextSlide} className="p-2 bg-nexus-800 hover:bg-nexus-700 text-white rounded-full transition-all active:scale-90"><ChevronRight size={16} /></button>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-white font-black text-sm italic">{currentSlide + 1} / {slidesCount}</span>
                            <div className="w-24 h-1 bg-nexus-800 mt-1 rounded-full overflow-hidden">
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

const LessonsLearnedView: React.FC<{ 
    projects: DetailedProject[]; 
    setProjects: React.Dispatch<React.SetStateAction<DetailedProject[]>>;
    hasApiKey: boolean;
    onOpenKeySelector: () => void;
}> = ({ projects, setProjects, hasApiKey, onOpenKeySelector }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    const archivedProjects = projects.filter(p => p.status === 'archived');

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleGenerateLessonsLearned = async () => {
        if (selectedIds.length === 0) {
            alert("Selecione ao menos uma obra para análise.");
            return;
        }

        // Verificar chave antes de gerar
        if (!hasApiKey) {
            const confirm = window.confirm("Para usar a IA, você precisa selecionar uma chave de API. Abrir seletor agora?");
            if (confirm) {
                onOpenKeySelector();
                return;
            } else {
                return;
            }
        }

        setIsAnalyzing(true);
        try {
            const selectedProjects = projects.filter(p => selectedIds.includes(p.id));
            const report = await generateLessonsLearnedReport(selectedProjects);
            setAnalysisResult(report);
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar análise de lições aprendidas.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <History className="text-yellow-400" /> Lições Aprendidas (Obras Finalizadas)
                </h3>
                <div className="flex gap-2">
                    {analysisResult && (
                        <button 
                            onClick={() => setAnalysisResult(null)}
                            className="bg-nexus-700 hover:bg-nexus-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                            Voltar para Lista
                        </button>
                    )}
                    <button 
                        onClick={handleGenerateLessonsLearned}
                        disabled={isAnalyzing || selectedIds.length === 0}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
                    >
                        {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                        Gerar Lições Aprendidas IA
                    </button>
                </div>
            </div>

            {analysisResult ? (
                <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 shadow-2xl animate-slideUp">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-nexus-700">
                        <h4 className="text-purple-400 font-black uppercase tracking-widest flex items-center gap-2">
                            <Bot size={20} /> Resultado da Inteligência Artificial
                        </h4>
                        <button 
                            onClick={() => {
                                const blob = new Blob([analysisResult], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Licoes_Aprendidas_Nexus_${new Date().toISOString().split('T')[0]}.md`;
                                a.click();
                            }}
                            className="text-nexus-400 hover:text-white flex items-center gap-1 text-xs font-bold"
                        >
                            <Download size={14} /> Exportar MD
                        </button>
                    </div>
                    <div className="prose prose-invert max-w-none prose-headings:text-purple-400 prose-strong:text-white prose-p:text-nexus-300">
                        <Markdown>{analysisResult}</Markdown>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedProjects.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-nexus-800 rounded-xl border-2 border-dashed border-nexus-700 text-nexus-500">
                            <FolderArchive size={40} className="mx-auto mb-2 opacity-20" />
                            Nenhuma obra arquivada para análise.
                        </div>
                    ) : (
                        archivedProjects.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => toggleSelect(p.id)}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden group ${
                                    selectedIds.includes(p.id) 
                                    ? 'bg-purple-900/20 border-purple-500 shadow-lg shadow-purple-900/20' 
                                    : 'bg-nexus-800 border-nexus-700 hover:border-nexus-600'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-white font-bold truncate pr-6">{p.name}</h4>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                        selectedIds.includes(p.id) ? 'bg-purple-500 border-purple-500' : 'border-nexus-600'
                                    }`}>
                                        {selectedIds.includes(p.id) && <CheckSquare size={14} className="text-white" />}
                                    </div>
                                </div>
                                <div className="space-y-1 text-[10px] text-nexus-400">
                                    <div className="flex justify-between">
                                        <span>CC: {p.costCenter}</span>
                                        <span>BU: {p.bu}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Período: {p.start} - {p.end}</span>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-nexus-700/50 flex justify-between items-center">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm(`Restaurar obra ${p.name} para Auditoria Ativa?`)) {
                                                setProjects(prev => prev.map(x => x.id === p.id ? { ...x, status: 'active' } : x));
                                            }
                                        }}
                                        className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
                                    >
                                        Restaurar
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm(`Excluir permanentemente ${p.name}?`)) {
                                                setProjects(prev => prev.filter(x => x.id !== p.id));
                                            }
                                        }}
                                        className="text-[9px] font-bold text-red-500/50 hover:text-red-500 uppercase tracking-tighter"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export const TeleinfoReport: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'presentation' | 'lessons_learned'>('dashboard');
    const [generalProjects] = useSupabaseData<any[]>('general_projects', []);
    const [detailedProjects, setDetailedProjects] = useSupabaseData<DetailedProject[]>('detailed_projects', []);
    const [buyingStatus] = useSupabaseData<ProjectBuyingStatus[]>('buying_status', []);

    // AI Report State moved to parent
    const [aiReport, setAiReport] = useState<{ content: string; projectName: string } | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [hasApiKey, setHasApiKey] = useState<boolean>(false);
    const [showDbHelp, setShowDbHelp] = useState(false);
    const [showManualKeyModal, setShowManualKeyModal] = useState(false);
    const [manualKeyInput, setManualKeyInput] = useState('');

    useEffect(() => {
        const checkKey = async () => {
            // Check manual key first
            const manualKey = localStorage.getItem('NEXUS_GEMINI_API_KEY');
            if (manualKey) {
                setHasApiKey(true);
                return;
            }

            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const selected = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(selected);
            }
        };
        checkKey();
    }, []);

    const handleSaveManualKey = () => {
        if (!manualKeyInput.trim()) {
            alert("Por favor, insira uma chave válida.");
            return;
        }
        localStorage.setItem('NEXUS_GEMINI_API_KEY', manualKeyInput.trim());
        setHasApiKey(true);
        setShowManualKeyModal(false);
        alert("Chave de API salva com sucesso no seu navegador!");
    };

    const handleOpenKeySelector = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            try {
                await window.aistudio.openSelectKey();
                setHasApiKey(true);
            } catch (err) {
                console.error("Erro ao abrir seletor de chaves:", err);
                setShowManualKeyModal(true);
            }
        } else {
            // Se não estiver no AI Studio, abre o modal manual
            setShowManualKeyModal(true);
        }
    };

    const handleGenerateAiReport = async (project: DetailedProject) => {
        console.log("Iniciando geração de relatório para:", project.name);
        
        // Garantir que a chave está selecionada antes de prosseguir
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const selected = await window.aistudio.hasSelectedApiKey();
            if (!selected) {
                const confirm = window.confirm("Para usar a IA, você precisa selecionar uma chave de API. Abrir seletor agora?");
                if (confirm) {
                    await handleOpenKeySelector();
                } else {
                    return;
                }
            }
        }

        setIsGeneratingReport(true);
        try {
            const report = await generateSeniorPlanningAuditReport(project);
            
            if (report.startsWith("Erro: API Key não configurada")) {
                alert("Chave de API não configurada.\n\nPor favor, siga estes passos:\n1. Clique no ícone de engrenagem (Settings) no canto superior direito.\n2. Vá em 'Secrets'.\n3. Adicione um segredo chamado GEMINI_API_KEY.\n4. Cole o valor da sua chave e salve.");
                
                if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
                    const confirmSelection = window.confirm("Deseja abrir o seletor de chaves da plataforma agora?");
                    if (confirmSelection) {
                        await window.aistudio.openSelectKey();
                    }
                }
                setIsGeneratingReport(false);
                return;
            }
            
            if (report.startsWith("Erro ao gerar relatório")) {
                alert(report);
                setIsGeneratingReport(false);
                return;
            }
            
            setAiReport({ content: report, projectName: project.name });
        } catch (error) {
            console.error("Erro na geração do relatório:", error);
            alert("Ocorreu um erro inesperado ao gerar o relatório. Verifique o console para detalhes técnicos.");
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
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowDbHelp(true)}
                        title="Ajuda com Erros de Banco"
                        className="p-2.5 bg-nexus-800 hover:bg-nexus-700 text-yellow-500 rounded-xl border border-nexus-700 transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase"
                    >
                        <AlertTriangle size={16} /> Erro de Banco?
                    </button>
                    <button 
                        onClick={handleOpenKeySelector}
                        title="Configurar Chave de API Gemini"
                        className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase ${
                            hasApiKey 
                            ? 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20' 
                            : 'bg-purple-600 border-purple-500 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/40'
                        }`}
                    >
                        <BrainCircuit size={16} /> {hasApiKey ? 'IA Habilitada' : 'Configurar IA'}
                    </button>
                    <button 
                        onClick={() => window.location.reload()}
                        title="Sincronizar com Banco de Dados"
                        className="p-2.5 bg-nexus-800 hover:bg-nexus-700 text-nexus-400 hover:text-white rounded-xl border border-nexus-700 transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase"
                    >
                        <RefreshCw size={16} /> Sincronizar
                    </button>
                    <div className="flex bg-nexus-800 p-1.5 rounded-xl border border-nexus-700 shadow-xl">
                        {['dashboard', 'monitoring', 'presentation', 'lessons_learned'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)}
                                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-500 hover:text-white'}`}>
                                {tab === 'dashboard' ? 'Geral' : tab === 'monitoring' ? 'Auditoria' : tab === 'presentation' ? 'Slides' : 'Lições'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                {activeTab === 'dashboard' && <GeneralDashboardView />}
                {activeTab === 'monitoring' && (
                    <MonitoringView 
                        projects={detailedProjects}
                        setProjects={setDetailedProjects}
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
                {activeTab === 'lessons_learned' && (
                    <LessonsLearnedView 
                        projects={detailedProjects}
                        setProjects={setDetailedProjects}
                        hasApiKey={hasApiKey}
                        onOpenKeySelector={handleOpenKeySelector}
                    />
                )}
            </div>

            {/* Manual API Key Modal */}
            {showManualKeyModal && (
                <div className="fixed inset-0 bg-black/80 z-[4000] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-nexus-800 border border-nexus-700 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
                        <div className="bg-purple-600 p-6 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <Key size={24} />
                                <h3 className="font-black text-lg uppercase italic">Configurar Chave Manual</h3>
                            </div>
                            <button onClick={() => setShowManualKeyModal(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-nexus-300 text-sm">
                                Como você está acessando fora do AI Studio, insira sua chave do Gemini manualmente. 
                                Ela será salva de forma segura apenas no seu navegador.
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-nexus-500 uppercase tracking-widest">GEMINI_API_KEY</label>
                                <input 
                                    type="password"
                                    value={manualKeyInput}
                                    onChange={(e) => setManualKeyInput(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-all font-mono text-sm"
                                />
                            </div>

                            <div className="bg-nexus-900 p-3 rounded-xl border border-nexus-700">
                                <p className="text-[10px] text-nexus-400 leading-relaxed">
                                    <strong>Onde conseguir?</strong> Acesse <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">aistudio.google.com</a> para gerar uma chave gratuita.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-nexus-700 flex gap-3 bg-nexus-800">
                            <button 
                                onClick={() => setShowManualKeyModal(false)} 
                                className="flex-1 bg-nexus-700 hover:bg-nexus-600 text-white py-3 rounded-xl font-bold transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveManualKey}
                                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20 text-sm"
                            >
                                Salvar Chave
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DB Help Modal */}
            {showDbHelp && (
                <div className="fixed inset-0 bg-black/80 z-[3000] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-nexus-800 border border-nexus-700 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="bg-yellow-600 p-6 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={32} />
                                <h3 className="font-black text-xl uppercase italic">Corrigir Erro de Banco</h3>
                            </div>
                            <button onClick={() => setShowDbHelp(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-nexus-300">Se você está vendo o erro <strong>"Could not find column"</strong>, siga estes passos no seu painel do Supabase:</p>
                            
                            <div className="space-y-4">
                                <div className="bg-nexus-900 p-4 rounded-xl border border-nexus-700">
                                    <p className="text-xs font-bold text-nexus-500 uppercase mb-2">1. Execute este SQL no SQL Editor:</p>
                                    <pre className="text-[10px] text-green-400 font-mono overflow-x-auto p-2 bg-black/30 rounded">
{`ALTER TABLE detailed_projects 
ADD COLUMN IF NOT EXISTS totalSoldValue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totalCostValue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totalUsedValue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`}
                                    </pre>
                                </div>
                                
                                <div className="bg-nexus-900 p-4 rounded-xl border border-nexus-700">
                                    <p className="text-xs font-bold text-nexus-500 uppercase mb-2">2. Force a atualização do Cache:</p>
                                    <pre className="text-[10px] text-blue-400 font-mono p-2 bg-black/30 rounded">
{`NOTIFY pgrst, 'reload schema';`}
                                    </pre>
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl">
                                <p className="text-xs text-blue-300"><strong>Dica:</strong> Após rodar os comandos, recarregue esta página segurando a tecla <strong>SHIFT</strong>.</p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-nexus-700 flex justify-end bg-nexus-800">
                            <button onClick={() => setShowDbHelp(false)} className="bg-nexus-700 hover:bg-nexus-600 text-white px-8 py-2 rounded-xl font-bold transition-all">Entendi</button>
                        </div>
                    </div>
                </div>
            )}

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
