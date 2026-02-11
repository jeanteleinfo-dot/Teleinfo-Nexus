
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, Line, Area
} from 'recharts';
import { 
  UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare, 
  Save, FilePlus, Trash2, Plus, Download, Tv, ArrowLeft, ArrowRight, User, Edit, Calendar, Layers, Activity, Radar, LayoutDashboard
} from 'lucide-react';
import { generateProjectRiskAnalysis, generateDetailedProjectRiskAnalysis } from '../services/geminiService';
import { Project, DetailedProject, DetailedProjectStep, BuHours, KeyFact, NextStep, MultiPhaseProject, ProductionData, FutureDelivery } from '../types';
import { syncToSupabase, fetchFromSupabase } from '../services/supabase';

// Declare html2pdf for TypeScript since it is loaded via CDN
declare const html2pdf: any;

// Hook para persistência no Supabase
function useSupabaseData<T>(tableName: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    useEffect(() => {
        const load = async () => {
            const data = await fetchFromSupabase<any>(tableName);
            if (data && data.length > 0) setStoredValue(data as unknown as T);
        };
        load();
    }, [tableName]);

    const setValue = (value: T | ((val: T) => T)) => {
        const val = value instanceof Function ? value(storedValue) : value;
        setStoredValue(val);
        if (Array.isArray(val)) syncToSupabase(tableName, val);
    };

    return [storedValue, setValue];
}

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
    if (headerRowIndex === -1) return [];
    const lines = allLines.slice(headerRowIndex).filter(l => l.replace(/;/g, '').trim().length > 0);
    if (lines.length < 2) return [];
    const sep = ";";
    const headers = lines[0].split(sep).map(h => h.trim());
    const idxMap = {
        cliente: headers.findIndex(h => h.toUpperCase() === 'CLIENTE'),
        tipoProjeto: headers.findIndex(h => h.toUpperCase() === 'TIPO DE PROJETO'),
        cCusto: headers.findIndex(h => h.toUpperCase() === 'C.CUSTO'),
        status: headers.findIndex(h => h.toUpperCase() === 'STATUS'),
        perc: headers.findIndex(h => h === '%'),
    };
    return lines.slice(1).map(line => {
        const cells = line.split(sep);
        return {
            'CLIENTE': cells[idxMap.cliente]?.trim() || "",
            'TIPO DE PROJETO': cells[idxMap.tipoProjeto]?.trim() || "",
            'TIPO DE PRODUTO': "", 'BUs': "",
            'C.Custo': cells[idxMap.cCusto]?.trim() || "",
            'STATUS': normalizeStatus(cells[idxMap.status]),
            perc: normalizePercent(cells[idxMap.perc]),
        };
    });
};

const parseProductionCsv = (text: string): ProductionData[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    return lines.slice(1).map(line => {
        const cols = line.split(';');
        const dateParts = cols[0].trim().split('/');
        return {
            date: `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`,
            meta: parseFloat(cols[1].replace(',', '.')),
            realized: parseFloat(cols[2]?.replace(',', '.'))
        };
    });
};

const statusColors: { [key: string]: { pill: string; chart: string } } = {
    'FINALIZADO': { pill: 'bg-green-500/10 text-green-400 border border-green-500/20', chart: '#22c55e' },
    'EM ANDAMENTO': { pill: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', chart: '#3b82f6' },
    'PARALIZADO': { pill: 'bg-red-500/10 text-red-400 border border-red-500/20', chart: '#ef4444' },
    'NÃO INICIADO': { pill: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', chart: '#eab308' },
    'DEFAULT': { pill: 'bg-nexus-500/10 text-nexus-400 border border-nexus-500/20', chart: '#6b7280' },
};

const getStatusChartColor = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized.startsWith("FINALIZADO")) return statusColors['FINALIZADO'].chart;
    if (normalized.startsWith("EM ANDAMENTO")) return statusColors['EM ANDAMENTO'].chart;
    if (normalized.startsWith("PARALIZADO")) return statusColors['PARALIZADO'].chart;
    if (normalized.startsWith("NÃO INICIADO")) return statusColors['NÃO INICIADO'].chart;
    return statusColors['DEFAULT'].chart;
};

// --- COMPONENTS ---

const RiskAnalysisModal: React.FC<{ content: string; isLoading: boolean; title: string; onClose: () => void }> = ({ content, isLoading, title, onClose }) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6 w-full max-w-lg relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-nexus-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Bot className="text-purple-400" /> {title}</h3>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <BrainCircuit size={48} className="animate-pulse text-blue-500" />
                    <span className="text-nexus-300">Consultando Gemini AI...</span>
                </div>
            ) : (
                <div className="prose prose-invert prose-sm max-w-none text-nexus-300 overflow-y-auto max-h-[60vh]" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} />
            )}
        </div>
    </div>
);

const MonitoringView: React.FC = () => {
    const [projects, setProjects] = useSupabaseData<DetailedProject[]>('detailed_projects', []);
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [riskModal, setRiskModal] = useState({ isOpen: false, content: '', isLoading: false });
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
                                            <button onClick={() => { setEditingProject(p); setViewMode('form'); }} className="p-2 text-blue-400"><Edit size={16}/></button>
                                            <button onClick={() => setProjects(projects.filter(x => x.id !== p.id))} className="p-2 text-red-400"><Trash2 size={16}/></button>
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
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'presentation'>('dashboard');

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Relatórios & Auditoria IA</h2>
                <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700">
                    {['dashboard', 'monitoring', 'presentation'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-400 hover:text-white'}`}>
                            {tab === 'dashboard' ? 'Geral' : tab === 'monitoring' ? 'Auditoria' : 'Slides'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1">
                {activeTab === 'monitoring' && <MonitoringView />}
            </div>
        </div>
    );
};
