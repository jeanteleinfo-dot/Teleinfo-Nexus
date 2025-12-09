
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare, 
  Save, FilePlus, Trash2, Plus, Download, Tv, ArrowLeft, ArrowRight, User, Edit, Calendar, Layers
} from 'lucide-react';
import { generateProjectRiskAnalysis, generateDetailedProjectRiskAnalysis } from '../services/geminiService';
import { Project, DetailedProject, DetailedProjectStep, BuHours, KeyFact, NextStep, MultiPhaseProject } from '../types';

// Declare html2pdf for TypeScript since it is loaded via CDN
declare const html2pdf: any;

// --- UTILS ---

const normalizePercent = (value: any): number | null => {
    if (value == null) return null;
    if (typeof value !== "string") value = String(value);
    const cleaned = value.replace("%", "").trim();
    if (!cleaned) return null;
    const num = parseFloat(cleaned.replace(",", "."));
    return isNaN(num) ? null : num;
};

const normalizeStatus = (status: any): string => {
    if (!status) return "";
    return status.toString().trim().toUpperCase();
};

const parseTeleinfoCsv = (text: string): Project[] => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    
    const allLines = text.split(/\r?\n/);
    const headerRowIndex = allLines.findIndex(l => l.toUpperCase().includes('CLIENTE'));

    if (headerRowIndex === -1) {
        alert("Erro: Coluna 'CLIENTE' não encontrada.");
        return [];
    }

    const lines = allLines.slice(headerRowIndex).filter(l => l.replace(/;/g, '').trim().length > 0);
    if (lines.length < 2) return [];

    const sep = ";";
    const headers = lines[0].split(sep).map(h => h.trim());

    const findIndex = (possibleNames: string[]) => {
        for (const name of possibleNames) {
            const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
            if (idx !== -1) return idx;
        }
        return -1;
    };
    
    const idxMap = {
        cliente: findIndex(['CLIENTE']),
        tipoProjeto: findIndex(['TIPO DE PROJETO']),
        tipoProduto: findIndex(['TIPO DE PRODUTO']),
        bus: findIndex(['BUs']),
        cCusto: findIndex(['C.Custo']),
        status: findIndex(['STATUS']),
        perc: findIndex(['%']),
    };
    
    const rows: Project[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(sep);
        const getCell = (idx: number) => cells[idx]?.trim() || "";
        const cliente = idxMap.cliente > -1 ? getCell(idxMap.cliente) : "";
        const cCusto = idxMap.cCusto > -1 ? getCell(idxMap.cCusto) : "";
        
        if (!cliente && !cCusto) continue;
        
        rows.push({
            'CLIENTE': cliente,
            'TIPO DE PROJETO': idxMap.tipoProjeto > -1 ? getCell(idxMap.tipoProjeto) : "",
            'TIPO DE PRODUTO': idxMap.tipoProduto > -1 ? getCell(idxMap.tipoProduto) : "",
            'BUs': idxMap.bus > -1 ? getCell(idxMap.bus) : "",
            'C.Custo': cCusto,
            'STATUS': normalizeStatus(idxMap.status > -1 ? getCell(idxMap.status) : ""),
            perc: normalizePercent(idxMap.perc > -1 ? getCell(idxMap.perc) : null),
        });
    }
    return rows;
};

const statusColors: { [key: string]: { pill: string; chart: string } } = {
    'FINALIZADO': { pill: 'bg-green-500/10 text-green-400 border border-green-500/20', chart: '#22c55e' },
    'EM ANDAMENTO': { pill: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', chart: '#3b82f6' },
    'PARALIZADO': { pill: 'bg-red-500/10 text-red-400 border border-red-500/20', chart: '#ef4444' },
    'NÃO INICIADO': { pill: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', chart: '#eab308' },
    'DEFAULT': { pill: 'bg-nexus-500/10 text-nexus-400 border border-nexus-500/20', chart: '#6b7280' },
};

const getStatusClass = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized.startsWith("FINALIZADO")) return statusColors['FINALIZADO'].pill;
    if (normalized.startsWith("EM ANDAMENTO")) return statusColors['EM ANDAMENTO'].pill;
    if (normalized.startsWith("PARALIZADO")) return statusColors['PARALIZADO'].pill;
    if (normalized.startsWith("NÃO INICIADO")) return statusColors['NÃO INICIADO'].pill;
    return statusColors['DEFAULT'].pill;
};

const getStatusChartColor = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized.startsWith("FINALIZADO")) return statusColors['FINALIZADO'].chart;
    if (normalized.startsWith("EM ANDAMENTO")) return statusColors['EM ANDAMENTO'].chart;
    if (normalized.startsWith("PARALIZADO")) return statusColors['PARALIZADO'].chart;
    if (normalized.startsWith("NÃO INICIADO")) return statusColors['NÃO INICIADO'].chart;
    return statusColors['DEFAULT'].chart;
};

const getBuChartColor = (bu: string): string => {
    const normalized = bu.trim().toUpperCase();
    if (normalized.includes('INFRAESTRUTURA')) return '#f97316';
    if (normalized.includes('SEGURANÇA')) return '#10b981';
    if (normalized.includes('TI')) return '#0b5ed7';
    if (normalized.includes('AUTOMAÇÃO')) return '#6b7280';
    return '#8b949e';
};

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.log(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.log(error);
        }
    };

    return [storedValue, setValue];
}

// --- COMPONENTS ---

const RiskAnalysisModal: React.FC<{ content: string; isLoading: boolean; title: string; onClose: () => void }> = ({ content, isLoading, title, onClose }) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6 w-full max-w-lg relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-nexus-400 hover:text-white transition-colors">
                <X size={20} />
            </button>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Bot className="text-purple-400" />
                {title}
            </h3>
            <div className="h-px bg-nexus-700 w-full mb-4"></div>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <BrainCircuit size={48} className="animate-pulse text-blue-500" />
                    <span className="text-nexus-300 animate-pulse">Consultando Gemini AI...</span>
                </div>
            ) : (
                <div className="prose prose-invert prose-sm max-w-none text-nexus-300 overflow-y-auto max-h-[60vh]" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} />
            )}
        </div>
    </div>
);

// --- VIEW: DASHBOARD ---

const DashboardView: React.FC<{ projects: Project[], onDataLoaded: (data: Project[], fileName: string) => void, fileName: string }> = ({ projects, onDataLoaded, fileName }) => {
    const [statusFilter, setStatusFilter] = useState('');
    const [buFilter, setBuFilter] = useState('');
    const [riskModal, setRiskModal] = useState<{ isOpen: boolean, content: string, isLoading: boolean }>({ isOpen: false, content: '', isLoading: false });
    const [monitoredCount, setMonitoredCount] = useState(0);

    useEffect(() => {
        const item = window.localStorage.getItem('nexus_teleinfo_detailed_projects');
        if (item) setMonitoredCount(JSON.parse(item).length);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseTeleinfoCsv(evt.target?.result as string);
            onDataLoaded(parsed, file.name);
        };
        reader.readAsText(file);
    };

    const filtered = useMemo(() => projects.filter(p => 
        (statusFilter ? p.STATUS === statusFilter : true) && (buFilter ? p.BUs === buFilter : true)
    ), [projects, statusFilter, buFilter]);

    const stats = useMemo(() => {
        const counts = { finished: 0, inProgress: 0, paralyzed: 0, notStarted: 0 };
        const statusChart: Record<string, number> = {};
        const buChart: Record<string, number> = {};

        filtered.forEach(p => {
            if (p.STATUS.startsWith("FINALIZADO")) counts.finished++;
            else if (p.STATUS.startsWith("EM ANDAMENTO")) counts.inProgress++;
            else if (p.STATUS.startsWith("PARALIZADO")) counts.paralyzed++;
            else if (p.STATUS.startsWith("NÃO INICIADO")) counts.notStarted++;

            statusChart[p.STATUS || "N/A"] = (statusChart[p.STATUS || "N/A"] || 0) + 1;
            buChart[p.BUs || "N/A"] = (buChart[p.BUs || "N/A"] || 0) + 1;
        });

        const percAvg = filtered.length ? filtered.reduce((a, b) => a + (b.perc || 0), 0) / filtered.length : 0;

        return {
            ...counts,
            total: filtered.length,
            avg: percAvg.toFixed(1),
            statusChart: Object.entries(statusChart).map(([k, v]) => ({ name: k, value: v, color: getStatusChartColor(k) })),
            buChart: Object.entries(buChart).map(([k, v]) => ({ name: k, value: v, color: getBuChartColor(k) }))
        };
    }, [filtered]);

    const handleAnalyze = async (project: Project) => {
        setRiskModal({ isOpen: true, content: '', isLoading: true });
        const result = await generateProjectRiskAnalysis(project);
        setRiskModal({ isOpen: true, content: result, isLoading: false });
    };

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center border-2 border-dashed border-nexus-700 rounded-2xl bg-nexus-800/30">
                <div className="w-20 h-20 bg-nexus-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                    <UploadCloud size={40} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Importar Dados</h2>
                <p className="text-nexus-400 mb-8 max-w-md">Carregue o arquivo CSV padrão do Teleinfo para gerar o dashboard inteligente.</p>
                <label className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-lg cursor-pointer transition-all hover:scale-105 shadow-lg shadow-blue-900/20">
                    <span>Selecionar CSV</span>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                </label>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {riskModal.isOpen && <RiskAnalysisModal title="Análise de Risco Rápida" content={riskModal.content} isLoading={riskModal.isLoading} onClose={() => setRiskModal({ ...riskModal, isOpen: false })} />}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-nexus-800 p-4 rounded-xl border border-nexus-700">
                <div>
                    <h2 className="text-xl font-bold text-white">Dashboard Geral</h2>
                    <p className="text-nexus-400 text-sm">Arquivo: <span className="text-blue-400">{fileName}</span></p>
                </div>
                <div className="flex gap-4">
                     <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-nexus-900 border border-nexus-600 text-white rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none">
                        <option value="">Todos Status</option>
                        {Array.from(new Set(projects.map(p => p.STATUS))).sort().map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                     <label className="flex items-center gap-2 bg-nexus-700 hover:bg-nexus-600 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium">
                        <UploadCloud size={16} /> Novo CSV
                        <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                    { label: 'Total', val: stats.total, color: 'text-white', icon: FileText },
                    { label: 'Monitorados', val: monitoredCount, color: 'text-orange-400', icon: GanttChartSquare },
                    { label: 'Média %', val: `${stats.avg}%`, color: 'text-blue-400', icon: FileText },
                    { label: 'Finalizados', val: stats.finished, color: 'text-green-400', icon: FileText },
                    { label: 'Andamento', val: stats.inProgress, color: 'text-blue-400', icon: FileText },
                    { label: 'Paralisados', val: stats.paralyzed, color: 'text-red-400', icon: FileText },
                    { label: 'N. Iniciado', val: stats.notStarted, color: 'text-yellow-400', icon: FileText },
                ].map((c, i) => (
                    <div key={i} className="bg-nexus-800 border border-nexus-700 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:border-nexus-600 transition-colors">
                        <c.icon size={20} className={`mb-2 ${c.color} opacity-80`} />
                        <span className="text-nexus-400 text-xs uppercase font-bold">{c.label}</span>
                        <span className={`text-xl font-bold ${c.color}`}>{c.val}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
                    <h3 className="text-white font-semibold mb-4">Projetos por Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer>
                            <BarChart data={stats.statusChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} />
                                <YAxis tick={{fill: '#94a3b8'}} />
                                <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc'}} />
                                <Bar dataKey="value">
                                    {stats.statusChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
                    <h3 className="text-white font-semibold mb-4">Por Unidade de Negócio</h3>
                    <div className="h-64">
                        <ResponsiveContainer>
                            <BarChart data={stats.buChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} />
                                <YAxis tick={{fill: '#94a3b8'}} />
                                <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc'}} />
                                <Bar dataKey="value">
                                    {stats.buChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-nexus-300">
                        <thead className="bg-nexus-900/50 text-nexus-400 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-6 py-3">Cliente</th>
                                <th className="px-6 py-3">Projeto</th>
                                <th className="px-6 py-3">BU</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-center">IA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-nexus-700">
                            {filtered.slice(0, 50).map((p, i) => (
                                <tr key={i} className="hover:bg-nexus-700/30">
                                    <td className="px-6 py-3 font-medium text-white">{p.CLIENTE}</td>
                                    <td className="px-6 py-3">{p['TIPO DE PROJETO']}</td>
                                    <td className="px-6 py-3">{p.BUs}</td>
                                    <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-xs ${getStatusClass(p.STATUS)}`}>{p.STATUS}</span></td>
                                    <td className="px-6 py-3 text-center">
                                        <button onClick={() => handleAnalyze(p)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-1.5 rounded transition-colors" title="Analisar Risco">
                                            <BrainCircuit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- VIEW: MONITORING ---

const MonitoringView: React.FC = () => {
    const [projects, setProjects] = useLocalStorage<DetailedProject[]>('nexus_teleinfo_detailed_projects', []);
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [riskModal, setRiskModal] = useState({ isOpen: false, content: '', isLoading: false });
    
    // State for the project being edited
    const [editingProject, setEditingProject] = useState<DetailedProject>({
        id: '', name: '', start: '', end: '', costCenter: '',
        steps: [], 
        soldHours: { infra: 0, sse: 0, ti: 0, aut: 0 }, 
        usedHours: { infra: 0, sse: 0, ti: 0, aut: 0 }
    });

    const handleNewProject = () => {
        setEditingProject({
            id: '', 
            name: '', 
            start: new Date().toISOString().split('T')[0], 
            end: '', 
            costCenter: '',
            steps: [{ name: 'Planejamento', perc: 0 }, { name: 'Execução', perc: 0 }, { name: 'Entrega', perc: 0 }],
            soldHours: { infra: 0, sse: 0, ti: 0, aut: 0 },
            usedHours: { infra: 0, sse: 0, ti: 0, aut: 0 }
        });
        setViewMode('form');
    };

    const handleEditProject = (project: DetailedProject) => {
        setEditingProject({ ...project }); // Clone to avoid direct mutation
        setViewMode('form');
    };

    const handleDeleteProject = (id: string) => {
        if (confirm("Tem certeza que deseja excluir este projeto?")) {
            setProjects(projects.filter(p => p.id !== id));
        }
    };

    const handleSave = () => {
        if (!editingProject.name) return alert("Nome do projeto é obrigatório");
        
        let updatedList: DetailedProject[];

        if (editingProject.id) {
            // Update existing
            updatedList = projects.map(p => p.id === editingProject.id ? editingProject : p);
        } else {
            // Create new
            const newProject = { ...editingProject, id: Date.now().toString() };
            updatedList = [...projects, newProject];
        }

        setProjects(updatedList);
        setViewMode('list');
        alert("Projeto salvo com sucesso!");
    };

    const handleAnalyze = async (project: DetailedProject) => {
        setRiskModal({ isOpen: true, content: '', isLoading: true });
        const result = await generateDetailedProjectRiskAnalysis(project);
        setRiskModal({ isOpen: true, content: result, isLoading: false });
    };

    // Render List View
    if (viewMode === 'list') {
        return (
            <div className="space-y-6 animate-fadeIn">
                 {riskModal.isOpen && <RiskAnalysisModal title="Auditoria de Projeto IA" content={riskModal.content} isLoading={riskModal.isLoading} onClose={() => setRiskModal({ ...riskModal, isOpen: false })} />}
                
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Auditoria Detalhada de Obras</h3>
                    <button onClick={handleNewProject} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-blue-900/20">
                        <Plus size={18} /> Novo Projeto
                    </button>
                </div>

                <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
                    {projects.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center text-nexus-400">
                            <BrainCircuit size={48} className="mb-4 opacity-50" />
                            <p className="text-lg">Nenhuma obra detalhada cadastrada.</p>
                            <p className="text-sm">Clique em "Novo Projeto" para começar a monitorar.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-nexus-300">
                                <thead className="bg-nexus-900/50 text-nexus-400 uppercase font-medium text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Projeto</th>
                                        <th className="px-6 py-4">Centro de Custo</th>
                                        <th className="px-6 py-4">Início</th>
                                        <th className="px-6 py-4">Término</th>
                                        <th className="px-6 py-4 text-center">Progresso</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-nexus-700">
                                    {projects.map((p) => {
                                         const globalPerc = p.steps.length > 0 
                                            ? Math.round(p.steps.reduce((acc, s) => acc + s.perc, 0) / p.steps.length)
                                            : 0;
                                        return (
                                            <tr key={p.id} className="hover:bg-nexus-700/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                                                <td className="px-6 py-4 font-mono">{p.costCenter || '-'}</td>
                                                <td className="px-6 py-4">{p.start ? new Date(p.start).toLocaleDateString() : '-'}</td>
                                                <td className="px-6 py-4">{p.end ? new Date(p.end).toLocaleDateString() : '-'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 h-1.5 bg-nexus-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${globalPerc}%` }}></div>
                                                        </div>
                                                        <span className="text-xs">{globalPerc}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleAnalyze(p)} className="p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-lg transition-colors" title="Auditoria IA">
                                                            <Bot size={16} />
                                                        </button>
                                                        <button onClick={() => handleEditProject(p)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors" title="Editar">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteProject(p.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Excluir">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render Form View
    const hoursData = Object.keys(editingProject.soldHours).map(key => {
        const k = key as keyof BuHours;
        return { name: k.toUpperCase(), Sold: editingProject.soldHours[k], Used: editingProject.usedHours[k] };
    });

    return (
        <div className="space-y-6 animate-fadeIn">
            {riskModal.isOpen && <RiskAnalysisModal title="Auditoria de Projeto IA" content={riskModal.content} isLoading={riskModal.isLoading} onClose={() => setRiskModal({ ...riskModal, isOpen: false })} />}

            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setViewMode('list')} className="p-2 bg-nexus-800 text-nexus-400 hover:text-white rounded-lg border border-nexus-700 hover:border-nexus-500 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">{editingProject.id ? 'Editar Projeto' : 'Novo Projeto'}</h3>
            </div>

            <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-nexus-400 mb-1 block">Nome do Projeto</label>
                            <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" placeholder="Ex: Migração Data Center" />
                        </div>
                        <div>
                            <label className="text-xs text-nexus-400 mb-1 block">Centro de Controle (C/C)</label>
                            <input type="text" value={editingProject.costCenter || ''} onChange={e => setEditingProject({...editingProject, costCenter: e.target.value})} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" placeholder="Ex: 10.01.01" />
                        </div>
                        <div>
                            <label className="text-xs text-nexus-400 mb-1 block">Data Início</label>
                            <input type="date" value={editingProject.start} onChange={e => setEditingProject({...editingProject, start: e.target.value})} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" />
                        </div>
                        <div>
                            <label className="text-xs text-nexus-400 mb-1 block">Data Término</label>
                            <input type="date" value={editingProject.end} onChange={e => setEditingProject({...editingProject, end: e.target.value})} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-green-900/20">
                        <Save size={18} /> Salvar
                    </button>
                    {editingProject.id && (
                        <button onClick={() => handleAnalyze(editingProject)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-purple-900/20">
                            <Bot size={18} /> Auditoria IA
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-semibold">Etapas e Progresso</h3>
                        <button onClick={() => setEditingProject({...editingProject, steps: [...editingProject.steps, {name: 'Nova Etapa', perc: 0}]})} className="text-blue-400 text-sm hover:underline flex items-center gap-1"><Plus size={14}/> Adicionar</button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {editingProject.steps.map((step, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <input type="text" value={step.name} onChange={e => {
                                    const newSteps = [...editingProject.steps];
                                    newSteps[i].name = e.target.value;
                                    setEditingProject({...editingProject, steps: newSteps});
                                }} className="flex-1 bg-nexus-900 border border-nexus-600 rounded p-1.5 text-sm text-white" />
                                <input type="number" min="0" max="100" value={step.perc} onChange={e => {
                                    const newSteps = [...editingProject.steps];
                                    newSteps[i].perc = Number(e.target.value);
                                    setEditingProject({...editingProject, steps: newSteps});
                                }} className="w-16 bg-nexus-900 border border-nexus-600 rounded p-1.5 text-sm text-white text-center" />
                                <button onClick={() => setEditingProject({...editingProject, steps: editingProject.steps.filter((_, idx) => idx !== i)})} className="text-red-400 hover:bg-red-400/10 p-1.5 rounded"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6">
                    <h3 className="text-white font-semibold mb-4">Controle de Horas (Orçado vs Realizado)</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {(Object.keys(editingProject.soldHours) as Array<keyof BuHours>).map(bu => (
                            <div key={bu} className="bg-nexus-900/50 p-3 rounded-lg border border-nexus-700">
                                <span className="text-xs uppercase text-nexus-400 font-bold block mb-2">{bu}</span>
                                <div className="flex gap-2">
                                    <div>
                                        <label className="text-[10px] text-nexus-500">Vendidas</label>
                                        <input type="number" value={editingProject.soldHours[bu]} onChange={e => setEditingProject({...editingProject, soldHours: {...editingProject.soldHours, [bu]: Number(e.target.value)}})} className="w-full bg-nexus-800 border-none rounded text-green-400 text-sm font-bold p-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-nexus-500">Usadas</label>
                                        <input type="number" value={editingProject.usedHours[bu]} onChange={e => setEditingProject({...editingProject, usedHours: {...editingProject.usedHours, [bu]: Number(e.target.value)}})} className="w-full bg-nexus-800 border-none rounded text-orange-400 text-sm font-bold p-1" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="h-40">
                         <ResponsiveContainer>
                            <BarChart data={hoursData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} />
                                <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc'}} />
                                <Bar dataKey="Sold" fill="#10b981" />
                                <Bar dataKey="Used" fill="#f97316" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- VIEW: PRESENTATION ---

const Slide: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-white text-gray-800 p-8 rounded-lg shadow-2xl print-slide aspect-[16/9] w-full flex flex-col relative overflow-hidden ${className || ''}`}>{children}</div>
);

const PresentationView: React.FC<{ allProjects: Project[] }> = ({ allProjects }) => {
    const [keyFacts, setKeyFacts] = useLocalStorage<KeyFact[]>('nexus_teleinfo_keyfacts', []);
    const [nextSteps, setNextSteps] = useLocalStorage<NextStep[]>('nexus_teleinfo_nextsteps', []);
    const [detailedProjects] = useLocalStorage<DetailedProject[]>('nexus_teleinfo_detailed_projects', []);
    const [multiPhaseProjects] = useLocalStorage<MultiPhaseProject[]>('nexus_stock_multiphase_projects', []);
    
    // Inputs
    const [factText, setFactText] = useState('');
    const [stepProj, setStepProj] = useState('');
    const [stepDesc, setStepDesc] = useState('');
    
    // Slide Mode
    const [isSlideMode, setIsSlideMode] = useState(false);
    const [slideIndex, setSlideIndex] = useState(0);

    const portfolioStats = useMemo(() => {
        const counts = { finished: 0, inProgress: 0, paralyzed: 0, notStarted: 0 };
        const statusChart: Record<string, number> = {};
        const buChart: Record<string, number> = {};

        allProjects.forEach(p => {
            if (p.STATUS.startsWith("FINALIZADO")) counts.finished++;
            else if (p.STATUS.startsWith("EM ANDAMENTO")) counts.inProgress++;
            else if (p.STATUS.startsWith("PARALIZADO")) counts.paralyzed++;
            else if (p.STATUS.startsWith("NÃO INICIADO")) counts.notStarted++;

            statusChart[p.STATUS || "N/A"] = (statusChart[p.STATUS || "N/A"] || 0) + 1;
            buChart[p.BUs || "N/A"] = (buChart[p.BUs || "N/A"] || 0) + 1;
        });

        const percAvg = allProjects.length ? allProjects.reduce((a, b) => a + (b.perc || 0), 0) / allProjects.length : 0;

        return {
            ...counts,
            total: allProjects.length,
            avg: percAvg.toFixed(1),
            statusChart: Object.entries(statusChart).map(([k, v]) => ({ name: k, value: v, color: getStatusChartColor(k) })),
            buChart: Object.entries(buChart).map(([k, v]) => ({ name: k, value: v, color: getBuChartColor(k) }))
        };
    }, [allProjects]);

    const phaseStats = useMemo(() => {
        if (!multiPhaseProjects.length) return null;
        const total = multiPhaseProjects.length;
        const avg = {
            triagem: multiPhaseProjects.reduce((acc, p) => acc + p.diasTriagem, 0) / total,
            kickoff: multiPhaseProjects.reduce((acc, p) => acc + p.diasKickoff, 0) / total,
            estoque: multiPhaseProjects.reduce((acc, p) => acc + p.diasEstoque, 0) / total,
        };
        return {
            averages: avg,
            chartData: [
                { name: 'Triagem', dias: parseFloat(avg.triagem.toFixed(2)), fill: '#3b82f6' },
                { name: 'Kickoff', dias: parseFloat(avg.kickoff.toFixed(2)), fill: '#8b5cf6' },
                { name: 'Estoque', dias: parseFloat(avg.estoque.toFixed(2)), fill: '#f59e0b' },
            ]
        };
    }, [multiPhaseProjects]);

    const slides = useMemo(() => [
        // Slide 1: Cover
        <Slide key="cover" className="!p-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="absolute top-0 right-0 w-[50%] h-full bg-blue-600/20 transform skew-x-[-20deg] origin-top"></div>
            <div className="relative z-10 flex flex-col justify-between h-full p-16">
                <div>
                    <h1 className="text-6xl font-bold tracking-tighter mb-4">
                        Tele<span className="text-blue-500">info</span>
                    </h1>
                    <p className="text-2xl font-light text-slate-300 uppercase tracking-widest">Status Report Integrado</p>
                </div>
                <div>
                    <p className="text-slate-400 text-lg">Gerado em: {new Date().toLocaleDateString()}</p>
                    <p className="text-slate-500 mt-2">Plataforma Nexus Enterprise</p>
                </div>
            </div>
        </Slide>,
        // Slide 2: Key Facts
        <Slide key="facts">
             <h2 className="text-3xl font-bold text-slate-800 mb-8 border-b pb-4">Destaques do Período</h2>
             <div className="grid grid-cols-1 gap-4">
                 {keyFacts.length ? keyFacts.map(f => (
                     <div key={f.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border-l-4 border-blue-500">
                         <div className="flex-1 text-lg">{f.text}</div>
                     </div>
                 )) : <p className="text-gray-400 italic">Nenhum fato relevante registrado.</p>}
             </div>
        </Slide>,
        // Slide 3: Portfolio (Replicating General Dashboard Layout)
        <Slide key="portfolio">
             <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-2">Visão do Portfólio</h2>
             
             {/* Metric Cards Grid */}
             <div className="grid grid-cols-7 gap-2 mb-6">
                {[
                    { label: 'Total', val: portfolioStats.total, color: 'text-slate-700', bg: 'bg-slate-100', icon: FileText },
                    { label: 'Monitorados', val: detailedProjects.length, color: 'text-orange-600', bg: 'bg-orange-50', icon: GanttChartSquare },
                    { label: 'Média %', val: `${portfolioStats.avg}%`, color: 'text-blue-600', bg: 'bg-blue-50', icon: FileText },
                    { label: 'Finalizados', val: portfolioStats.finished, color: 'text-green-600', bg: 'bg-green-50', icon: FileText },
                    { label: 'Andamento', val: portfolioStats.inProgress, color: 'text-blue-600', bg: 'bg-blue-50', icon: FileText },
                    { label: 'Paralisados', val: portfolioStats.paralyzed, color: 'text-red-600', bg: 'bg-red-50', icon: FileText },
                    { label: 'N. Iniciado', val: portfolioStats.notStarted, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: FileText },
                ].map((c, i) => (
                    <div key={i} className={`${c.bg} p-2 rounded-lg flex flex-col items-center justify-center text-center border border-slate-200`}>
                        <c.icon size={16} className={`mb-1 ${c.color} opacity-80`} />
                        <span className="text-slate-500 text-[10px] uppercase font-bold">{c.label}</span>
                        <span className={`text-lg font-bold ${c.color}`}>{c.val}</span>
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-6 h-full pb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-slate-700 font-semibold mb-4">Projetos por Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer>
                            <BarChart data={portfolioStats.statusChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10}} />
                                <YAxis tick={{fill: '#64748b'}} />
                                <Bar dataKey="value">
                                    {portfolioStats.statusChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-slate-700 font-semibold mb-4">Por Unidade de Negócio</h3>
                    <div className="h-64">
                        <ResponsiveContainer>
                            <BarChart data={portfolioStats.buChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10}} />
                                <YAxis tick={{fill: '#64748b'}} />
                                <Bar dataKey="value">
                                    {portfolioStats.buChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </Slide>,
        // Slide 4: SLA Overview (New)
        <Slide key="sla-phases">
            <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-2">Visão Geral de SLA (Fases)</h2>
            {phaseStats ? (
                <>
                    <div className="grid grid-cols-3 gap-6 mb-8">
                         <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-500 font-bold uppercase">Média Triagem</p>
                                <p className="text-4xl font-bold text-blue-700">{phaseStats.averages.triagem.toFixed(1)} <span className="text-base font-normal text-blue-400">dias</span></p>
                            </div>
                            <Layers className="text-blue-300" size={48} />
                         </div>
                         <div className="bg-purple-50 p-6 rounded-lg border border-purple-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-500 font-bold uppercase">Média Kickoff</p>
                                <p className="text-4xl font-bold text-purple-700">{phaseStats.averages.kickoff.toFixed(1)} <span className="text-base font-normal text-purple-400">dias</span></p>
                            </div>
                            <Layers className="text-purple-300" size={48} />
                         </div>
                         <div className="bg-amber-50 p-6 rounded-lg border border-amber-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-500 font-bold uppercase">Média Estoque</p>
                                <p className="text-4xl font-bold text-amber-700">{phaseStats.averages.estoque.toFixed(1)} <span className="text-base font-normal text-amber-400">dias</span></p>
                            </div>
                            <Layers className="text-amber-300" size={48} />
                         </div>
                    </div>
                    <div className="h-64 bg-slate-50 rounded-xl p-6 border border-slate-200">
                         <h3 className="text-slate-700 font-semibold mb-4">Comparativo de Médias por Fase</h3>
                         <ResponsiveContainer>
                            <BarChart data={phaseStats.chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                <XAxis type="number" stroke="#64748b" />
                                <YAxis dataKey="name" type="category" stroke="#64748b" width={80} />
                                <Bar dataKey="dias" radius={[0, 4, 4, 0]} barSize={40}>
                                    {phaseStats.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Layers size={64} className="mb-4 opacity-20" />
                    <p className="text-xl">Nenhum dado de SLA/Fases encontrado.</p>
                    <p className="text-sm">Importe os dados no módulo de "Estoque & Compras" > "Controle Fases".</p>
                </div>
            )}
        </Slide>,
        // Detailed Projects Slides
        ...detailedProjects.map(p => {
            // Calculations for Time Progress
            const start = new Date(p.start);
            const end = new Date(p.end);
            const now = new Date();
            let timeProgress = 0;
            if (p.start && p.end && end > start) {
                const total = end.getTime() - start.getTime();
                const elapsed = now.getTime() - start.getTime();
                timeProgress = Math.min(100, Math.max(0, (elapsed / total) * 100));
            }

            // Calculation for Global Project Percentage (Average of steps)
            const globalPerc = p.steps.length > 0 
                ? Math.round(p.steps.reduce((acc, s) => acc + s.perc, 0) / p.steps.length)
                : 0;

            return (
                <Slide key={p.id}>
                    <div className="flex justify-between items-start border-b pb-4 mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">
                                {p.costCenter && <span className="text-gray-500 mr-2 text-xl font-medium">[{p.costCenter}]</span>}
                                {p.name}
                            </h2>
                            <span className="text-sm text-gray-500 mt-1 block">Período: {p.start} a {p.end}</span>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className="text-right">
                                 <span className="block text-xs font-bold text-gray-400 uppercase">Progresso Global</span>
                                 <span className="text-3xl font-bold text-blue-600">{globalPerc}%</span>
                             </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8 h-full pb-12">
                        <div>
                            <h3 className="font-semibold mb-4 text-slate-600">Cronograma</h3>
                            <div className="space-y-4">
                                {p.steps.map((s, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm mb-1"><span>{s.name}</span><span>{s.perc}%</span></div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${s.perc}%`}}></div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-4 text-slate-600">Performance de Horas</h3>
                            <div className="h-48">
                                <ResponsiveContainer>
                                    <BarChart data={Object.keys(p.soldHours).map(k => ({name: k.toUpperCase(), Sold: p.soldHours[k as keyof BuHours], Used: p.usedHours[k as keyof BuHours]}))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" fontSize={10} />
                                        <Legend />
                                        <Bar dataKey="Sold" fill="#10b981" />
                                        <Bar dataKey="Used" fill="#f97316" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Time Progress Bar Footer */}
                    <div className="absolute bottom-0 left-0 w-full bg-gray-50 border-t border-gray-100">
                         <div className="flex justify-between px-8 py-1 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                             <span>Início: {p.start}</span>
                             <span>Cronograma Decorrido: {timeProgress.toFixed(1)}%</span>
                             <span>Término: {p.end}</span>
                         </div>
                         <div className="w-full h-2 bg-gray-200">
                             <div 
                                className={`h-full transition-all duration-1000 ${timeProgress >= 100 ? 'bg-red-500' : 'bg-slate-600'}`}
                                style={{width: `${timeProgress}%`}}
                             ></div>
                         </div>
                    </div>
                </Slide>
            );
        }),
        // Next Steps
        <Slide key="next">
            <h2 className="text-3xl font-bold text-slate-800 mb-8 border-b pb-4">Próximos Passos</h2>
             <div className="grid grid-cols-1 gap-4">
                 {nextSteps.length ? nextSteps.map(s => (
                     <div key={s.id} className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                         <div className="font-bold text-orange-900">{s.project}</div>
                         <div className="text-orange-800">{s.description}</div>
                     </div>
                 )) : <p className="text-gray-400 italic">Nenhum próximo passo registrado.</p>}
             </div>
        </Slide>
    ], [portfolioStats, keyFacts, detailedProjects, nextSteps, phaseStats]);

    const generatePdf = () => {
        const element = document.getElementById('presentation-content');
        const opt = {
            margin: 0,
            filename: `Relatorio_Status_Nexus_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        // @ts-ignore
        html2pdf().from(element).set(opt).save();
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {isSlideMode && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                    <div className="w-full max-w-6xl aspect-video bg-white">
                        {slides[slideIndex]}
                    </div>
                    <div className="absolute bottom-4 flex gap-4 text-white">
                        <button onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}><ArrowLeft size={32}/></button>
                        <span>{slideIndex + 1} / {slides.length}</span>
                        <button onClick={() => setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))}><ArrowRight size={32}/></button>
                        <button onClick={() => setIsSlideMode(false)}><X size={32}/></button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-nexus-800 p-4 rounded-xl border border-nexus-700">
                <h2 className="text-xl font-bold text-white">Gerador de Apresentação</h2>
                <div className="flex gap-2">
                    <button onClick={() => setIsSlideMode(true)} className="bg-nexus-700 hover:bg-nexus-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Tv size={18} /> Apresentar
                    </button>
                    <button onClick={generatePdf} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Download size={18} /> PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 space-y-4">
                    <h3 className="text-white font-semibold">Adicionar Fatos Relevantes</h3>
                    <div className="flex gap-2">
                        <input type="text" value={factText} onChange={e => setFactText(e.target.value)} className="flex-1 bg-nexus-900 border border-nexus-600 rounded p-2 text-white" placeholder="Fato importante..." />
                        <button onClick={() => { if(factText) { setKeyFacts([...keyFacts, {id: Date.now().toString(), text: factText}]); setFactText(''); }}} className="bg-blue-600 text-white p-2 rounded"><Plus size={20}/></button>
                    </div>
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {keyFacts.map(f => (
                            <li key={f.id} className="flex justify-between bg-nexus-900/50 p-2 rounded text-sm text-nexus-300">
                                {f.text} <button onClick={() => setKeyFacts(keyFacts.filter(x => x.id !== f.id))} className="text-red-400"><Trash2 size={14}/></button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 space-y-4">
                    <h3 className="text-white font-semibold">Próximos Passos</h3>
                    <div className="space-y-2">
                        <input type="text" value={stepProj} onChange={e => setStepProj(e.target.value)} className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" placeholder="Projeto..." />
                        <div className="flex gap-2">
                            <input type="text" value={stepDesc} onChange={e => setStepDesc(e.target.value)} className="flex-1 bg-nexus-900 border border-nexus-600 rounded p-2 text-white" placeholder="Ação..." />
                            <button onClick={() => { if(stepProj && stepDesc) { setNextSteps([...nextSteps, {id: Date.now().toString(), project: stepProj, description: stepDesc}]); setStepProj(''); setStepDesc(''); }}} className="bg-blue-600 text-white p-2 rounded"><Plus size={20}/></button>
                        </div>
                    </div>
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {nextSteps.map(s => (
                            <li key={s.id} className="flex justify-between bg-nexus-900/50 p-2 rounded text-sm text-nexus-300">
                                <span><b>{s.project}:</b> {s.description}</span> <button onClick={() => setNextSteps(nextSteps.filter(x => x.id !== s.id))} className="text-red-400"><Trash2 size={14}/></button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div id="presentation-content" className="bg-gray-200 p-8 rounded-xl space-y-8 overflow-hidden">
                <p className="text-center text-gray-500 text-sm mb-4">Pré-visualização do Relatório (Conteúdo gerado para PDF)</p>
                {slides.map((slide, i) => <div key={i} className="transform scale-95 origin-center shadow-lg">{slide}</div>)}
            </div>
        </div>
    );
};

export const TeleinfoReport: React.FC = () => {
    const [projects, setProjects] = useLocalStorage<Project[]>('nexus_teleinfo_projects', []);
    const [fileName, setFileName] = useState('');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'presentation'>('dashboard');

    const handleDataLoaded = (data: Project[], name: string) => {
        setProjects(data);
        setFileName(name);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Relatórios Inteligentes IA</h2>
                    <p className="text-nexus-400">Análise de Projetos e Geração de Status Report</p>
                </div>
                <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700">
                    {[
                        { id: 'dashboard', label: 'Dashboard Geral', icon: FileText },
                        { id: 'monitoring', label: 'Auditoria Detalhada', icon: GanttChartSquare },
                        { id: 'presentation', label: 'Apresentação', icon: Tv },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                activeTab === tab.id 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : 'text-nexus-400 hover:text-white hover:bg-nexus-700'
                            }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {activeTab === 'dashboard' && <DashboardView projects={projects} onDataLoaded={handleDataLoaded} fileName={fileName} />}
                {activeTab === 'monitoring' && <MonitoringView />}
                {activeTab === 'presentation' && <PresentationView allProjects={projects} />}
            </div>
        </div>
    );
};
