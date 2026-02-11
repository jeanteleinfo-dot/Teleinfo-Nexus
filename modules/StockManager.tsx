
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend 
} from 'recharts';
import { StockItem, SLAProject, MultiPhaseProject, SLAStatus, ProjectBuyingStatus } from '../types';
import { 
  ArrowUpRight, ArrowDownRight, Package, DollarSign, UploadCloud, 
  AlertTriangle, CheckCircle, Clock, X, Mail, BarChart2, Layers, ShoppingCart, Calendar, Info, Trash2
} from 'lucide-react';
import { syncToSupabase, fetchFromSupabase } from '../services/supabase';

// --- CONSTANTS & UTILS ---

const SLA_DAYS_WARNING = 5;
const SLA_DAYS_CRITICAL = 7;

const COLORS = {
  OK: '#22c55e',
  WARNING: '#eab308',
  CRITICAL: '#ef4444'
};

function useSupabaseData<T>(tableName: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    useEffect(() => {
        const loadData = async () => {
            const data = await fetchFromSupabase<any>(tableName);
            if (data && data.length > 0) {
                setStoredValue(data as unknown as T);
            }
        };
        loadData();
    }, [tableName]);

    const setValue = (value: T | ((val: T) => T)) => {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (Array.isArray(valueToStore)) {
            syncToSupabase(tableName, valueToStore);
        }
    };

    return [storedValue, setValue];
}

const parseBuyingStatusCSV = (text: string): ProjectBuyingStatus[] => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: ProjectBuyingStatus[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 3) continue;
        const rawStatus = cols[2]?.trim() || 'Padrão';
        let status: 'Padrão' | 'Intermediário' | 'Crítico' = 'Padrão';
        if (rawStatus.toLowerCase().includes('critico') || rawStatus.toLowerCase().includes('crítico')) status = 'Crítico';
        else if (rawStatus.toLowerCase().includes('intermediario') || rawStatus.toLowerCase().includes('intermediário')) status = 'Intermediário';
        
        result.push({
            id: `buy-${i}-${Date.now()}`,
            projeto: cols[0]?.trim() || 'N/A',
            numeroProjeto: cols[1]?.trim() || 'N/A',
            status: status,
            aComprar: cols[3]?.trim() || '-',
            comprados: cols[4]?.trim() || '-',
            entregue: cols[5]?.trim() || '-',
            dataDisponivel: cols[6]?.trim() || 'A definir',
        });
    }
    return result;
};

const parseProjectsCSV = (text: string): SLAProject[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    return lines.slice(1).map((line, i) => {
        const cols = line.split(';');
        return {
            id: `proj-${i}-${Date.now()}`,
            titulo: cols[0]?.trim() || 'Sem Título',
            numeroProjeto: cols[1]?.trim() || 'N/A',
            inicioFase: cols[2]?.trim() || new Date().toISOString(),
            diasNaFase: parseFloat(cols[3]?.replace(',', '.') || '0'),
            entregaTeleinfo: cols[4]?.trim()
        };
    });
};

const getSLAStatus = (days: number): SLAStatus => {
  if (days > SLA_DAYS_CRITICAL) return SLAStatus.CRITICAL;
  if (days > SLA_DAYS_WARNING) return SLAStatus.WARNING;
  return SLAStatus.OK;
};

// --- COMPONENTS ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string }> = ({ title, value, icon, colorClass }) => (
    <div className="bg-nexus-800 rounded-xl border border-nexus-700 p-6 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-nexus-400 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass} text-white`}>{icon}</div>
    </div>
);

// --- VIEW COMPONENTS ---

const ProjectBuyingStatusView: React.FC = () => {
    const [buyingData, setBuyingData] = useSupabaseData<ProjectBuyingStatus[]>('buying_status', []);
    const [selectedProject, setSelectedProject] = useState<ProjectBuyingStatus | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stats = useMemo(() => ({
        total: buyingData?.length || 0,
        critical: buyingData?.filter(p => p.status === 'Crítico').length || 0,
    }), [buyingData]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseBuyingStatusCSV(evt.target?.result as string);
            setBuyingData(parsed);
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ShoppingCart size={20} className="text-blue-400"/> Status de Compras
                </h3>
                <div className="flex gap-2">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-nexus-800 border border-nexus-600 rounded-lg text-sm text-white hover:border-blue-500 transition-all">
                        <UploadCloud size={16} /> Importar Status
                    </button>
                    {buyingData?.length > 0 && <button onClick={() => setBuyingData([])} className="p-2 text-nexus-500 hover:text-red-400"><Trash2 size={20}/></button>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard title="Projetos Mapeados" value={stats.total} icon={<Package size={24}/>} colorClass="bg-blue-600" />
                <StatCard title="Status Crítico" value={stats.critical} icon={<AlertTriangle size={24}/>} colorClass="bg-red-600" />
            </div>

            <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden shadow-xl">
                <table className="w-full text-sm text-left">
                    <thead className="bg-nexus-900 text-nexus-400 uppercase font-bold text-[10px]">
                        <tr>
                            <th className="px-6 py-4">Projeto</th>
                            <th className="px-6 py-4">Centro de Custo</th>
                            <th className="px-6 py-4">Criticidade</th>
                            <th className="px-6 py-4">A Comprar</th>
                            <th className="px-6 py-4">Data Disponível</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-nexus-700">
                        {buyingData?.map((item) => (
                            <tr key={item.id} className={`hover:bg-nexus-700/30 ${item.status === 'Crítico' ? 'text-red-400 border-l-2 border-red-500' : 'text-nexus-300'}`}>
                                <td className="px-6 py-4 font-bold">{item.projeto}</td>
                                <td className="px-6 py-4 font-mono text-xs">{item.numeroProjeto}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.status === 'Crítico' ? 'bg-red-500 text-white' : 'bg-nexus-600'}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{item.aComprar}</td>
                                <td className="px-6 py-4 font-mono text-xs">{item.dataDisponivel}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const StockManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'control' | 'status'>('status');

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Estoque & Compras</h2>
          <p className="text-nexus-400">Dados persistidos no Supabase</p>
        </div>
        <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700">
            {['status', 'monitor', 'control'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-nexus-400 hover:text-white'}`}
                >
                    {tab === 'status' ? 'Status' : tab === 'monitor' ? 'SLA' : 'Fases'}
                </button>
            ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
          {activeTab === 'status' && <ProjectBuyingStatusView />}
      </div>
    </div>
  );
};
