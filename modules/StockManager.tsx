
import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend 
} from 'recharts';
import { StockItem, SLAProject, MultiPhaseProject, SLAStatus, ProjectBuyingStatus } from '../types';
import { 
  ArrowUpRight, ArrowDownRight, Package, DollarSign, UploadCloud, 
  AlertTriangle, CheckCircle, Clock, X, Mail, BarChart2, Layers, ShoppingCart, Calendar, Info
} from 'lucide-react';

// --- CONSTANTS & UTILS ---

const SLA_DAYS_WARNING = 5;
const SLA_DAYS_CRITICAL = 7;

const COLORS = {
  OK: '#22c55e',      // green-500
  WARNING: '#eab308', // yellow-500
  CRITICAL: '#ef4444' // red-500
};

// LocalStorage Hook
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

// CSV Parsers
const parseProjectsCSV = (text: string): SLAProject[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: SLAProject[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 4) continue;
        result.push({
            id: `proj-${i}-${Date.now()}`,
            titulo: cols[0]?.trim() || 'Sem Título',
            numeroProjeto: cols[1]?.trim() || 'N/A',
            inicioFase: cols[2]?.trim() || new Date().toISOString(),
            diasNaFase: parseFloat(cols[3]?.replace(',', '.') || '0'),
            entregaTeleinfo: cols[4]?.trim()
        });
    }
    return result;
};

const parseMultiPhaseCSV = (text: string): MultiPhaseProject[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: MultiPhaseProject[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 5) continue;
        result.push({
            id: `phase-${i}-${Date.now()}`,
            titulo: cols[0]?.trim() || '',
            numeroProjeto: cols[1]?.trim() || '',
            diasTriagem: parseFloat(cols[2]?.replace(',', '.') || '0'),
            diasKickoff: parseFloat(cols[3]?.replace(',', '.') || '0'),
            diasEstoque: parseFloat(cols[4]?.replace(',', '.') || '0'),
        });
    }
    return result;
};

const parseBuyingStatusCSV = (text: string): ProjectBuyingStatus[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: ProjectBuyingStatus[] = [];
    // Expected: Projeto;Status;A comprar;Comprados;Entregue;Data disponivel
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 5) continue;

        const rawStatus = cols[1]?.trim() || 'Padrão';
        let status: 'Padrão' | 'Intermediário' | 'Crítico' = 'Padrão';
        if (rawStatus.toLowerCase().includes('critico') || rawStatus.toLowerCase().includes('crítico')) status = 'Crítico';
        else if (rawStatus.toLowerCase().includes('intermediario') || rawStatus.toLowerCase().includes('intermediário')) status = 'Intermediário';

        result.push({
            id: `buy-${i}-${Date.now()}`,
            projeto: cols[0]?.trim() || 'N/A',
            status: status,
            aComprar: cols[2]?.trim() || '-',
            comprados: cols[3]?.trim() || '-',
            entregue: cols[4]?.trim() || '-',
            dataDisponivel: cols[5]?.trim() || 'A definir',
        });
    }
    return result;
};

const getSLAStatus = (days: number): SLAStatus => {
  if (days > SLA_DAYS_CRITICAL) return SLAStatus.CRITICAL;
  if (days > SLA_DAYS_WARNING) return SLAStatus.WARNING;
  return SLAStatus.OK;
};

// --- COMPONENTS ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string; description?: string }> = ({ title, value, icon, colorClass, description }) => (
    <div className="bg-nexus-800 rounded-xl border border-nexus-700 p-6 flex items-start justify-between transition-all hover:border-nexus-600">
      <div>
        <p className="text-sm font-medium text-nexus-400 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        {description && <p className="text-xs text-nexus-500 mt-2">{description}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass} text-white`}>
        {icon}
      </div>
    </div>
);

const BuyingStatusModal: React.FC<{ isOpen: boolean; onClose: () => void; project: ProjectBuyingStatus | null }> = ({ isOpen, onClose, project }) => {
    if (!isOpen || !project) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4" onClick={onClose}>
            <div className="bg-nexus-800 border-2 border-red-500/50 rounded-2xl p-8 w-full max-w-2xl shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-scaleIn" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest mb-2 inline-block animate-pulse">Status Crítico</span>
                        <h3 className="text-2xl font-bold text-white">{project.projeto}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-nexus-400 hover:text-white hover:bg-nexus-700 rounded-full transition-colors"><X size={24}/></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-nexus-900/50 p-4 rounded-xl border border-nexus-700">
                        <p className="text-xs text-nexus-500 font-bold uppercase mb-2 flex items-center gap-2"><ShoppingCart size={14} className="text-red-400"/> A Comprar</p>
                        <p className="text-white text-lg">{project.aComprar}</p>
                    </div>
                    <div className="bg-nexus-900/50 p-4 rounded-xl border border-nexus-700">
                        <p className="text-xs text-nexus-500 font-bold uppercase mb-2 flex items-center gap-2"><CheckCircle size={14} className="text-blue-400"/> Comprados</p>
                        <p className="text-white text-lg">{project.comprados}</p>
                    </div>
                    <div className="bg-nexus-900/50 p-4 rounded-xl border border-nexus-700">
                        <p className="text-xs text-nexus-500 font-bold uppercase mb-2 flex items-center gap-2"><Package size={14} className="text-green-400"/> Entregue</p>
                        <p className="text-white text-lg">{project.entregue}</p>
                    </div>
                    <div className="bg-nexus-900/50 p-4 rounded-xl border border-nexus-700">
                        <p className="text-xs text-nexus-500 font-bold uppercase mb-2 flex items-center gap-2"><Calendar size={14} className="text-yellow-400"/> Data Disponível</p>
                        <p className="text-white text-lg font-mono">{project.dataDisponivel}</p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button onClick={onClose} className="bg-nexus-700 hover:bg-nexus-600 text-white px-8 py-3 rounded-xl font-bold transition-all">Fechar Detalhes</button>
                </div>
            </div>
        </div>
    );
};

// --- SUB-VIEWS ---

const ProjectBuyingStatusView: React.FC = () => {
    const [buyingData, setBuyingData] = useLocalStorage<ProjectBuyingStatus[]>('nexus_stock_buying_status', []);
    const [selectedProject, setSelectedProject] = useState<ProjectBuyingStatus | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseBuyingStatusCSV(evt.target?.result as string);
            setBuyingData(parsed);
            alert(`${parsed.length} projetos carregados.`);
        };
        reader.readAsText(file);
    };

    const stats = useMemo(() => ({
        total: buyingData.length,
        critical: buyingData.filter(p => p.status === 'Crítico').length,
        intermediate: buyingData.filter(p => p.status === 'Intermediário').length,
        standard: buyingData.filter(p => p.status === 'Padrão').length,
    }), [buyingData]);

    const getRowStyle = (status: string) => {
        switch (status) {
            case 'Crítico': return 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-l-4 border-red-500 cursor-pointer';
            case 'Intermediário': return 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-l-4 border-yellow-500';
            case 'Padrão': return 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-l-4 border-green-500';
            default: return 'hover:bg-nexus-700/30';
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ShoppingCart size={20} className="text-blue-400"/> Status de Compras por Projeto
                </h3>
                <div className="flex gap-4">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-nexus-800 border border-nexus-600 rounded-lg text-sm text-white hover:border-blue-500 transition-colors shadow-lg">
                        <UploadCloud size={16} /> Importar CSV Status
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Projetos em Compras" value={stats.total} icon={<Package size={24}/>} colorClass="bg-blue-600" />
                <StatCard title="Status Crítico" value={stats.critical} icon={<AlertTriangle size={24} className="animate-pulse"/>} colorClass="bg-red-600" />
                <StatCard title="Status Intermediário" value={stats.intermediate} icon={<Info size={24}/>} colorClass="bg-yellow-600" />
                <StatCard title="Status Padrão" value={stats.standard} icon={<CheckCircle size={24}/>} colorClass="bg-green-600" />
            </div>

            <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-nexus-900/80 text-nexus-400 uppercase font-bold text-xs sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-4">Projeto</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">A Comprar</th>
                                <th className="px-6 py-4">Comprados</th>
                                <th className="px-6 py-4">Entregue</th>
                                <th className="px-6 py-4">Data Disponível</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-nexus-700">
                            {buyingData.map((item) => (
                                <tr 
                                    key={item.id} 
                                    className={`transition-all ${getRowStyle(item.status)}`}
                                    onClick={() => {
                                        if (item.status === 'Crítico') {
                                            setSelectedProject(item);
                                            setIsModalOpen(true);
                                        }
                                    }}
                                >
                                    <td className="px-6 py-4 font-bold">{item.projeto}</td>
                                    <td className="px-6 py-4">
                                        <span className="uppercase text-[10px] font-black tracking-widest">{item.status}</span>
                                    </td>
                                    <td className="px-6 py-4">{item.aComprar}</td>
                                    <td className="px-6 py-4">{item.comprados}</td>
                                    <td className="px-6 py-4">{item.entregue}</td>
                                    <td className="px-6 py-4 font-mono">{item.dataDisponivel}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {buyingData.length === 0 && (
                        <div className="p-20 text-center flex flex-col items-center justify-center text-nexus-500">
                            <ShoppingCart size={64} className="mb-4 opacity-20"/>
                            <p className="text-xl">Nenhum dado de compras importado.</p>
                            <p className="text-sm">Utilize o botão de importação para carregar o arquivo CSV.</p>
                        </div>
                    )}
                </div>
            </div>

            <BuyingStatusModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                project={selectedProject} 
            />
        </div>
    );
};

const StockMonitoringView: React.FC = () => {
    const [projects, setProjects] = useLocalStorage<SLAProject[]>('nexus_stock_sla_projects', []);
    const [selectedProject, setSelectedProject] = useState<SLAProject | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stats = useMemo(() => {
        const total = projects.length;
        const delayed = projects.filter(p => p.diasNaFase > SLA_DAYS_CRITICAL).length;
        const warning = projects.filter(p => p.diasNaFase > SLA_DAYS_WARNING && p.diasNaFase <= SLA_DAYS_CRITICAL).length;
        const avgDays = total > 0 ? projects.reduce((acc, curr) => acc + curr.diasNaFase, 0) / total : 0;
        return { total, delayed, warning, avgDays };
    }, [projects]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseProjectsCSV(evt.target?.result as string);
            setProjects(parsed);
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Monitoramento de Prazos (SLA)</h3>
                <div className="flex gap-4">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-nexus-800 border border-nexus-600 rounded-lg text-sm text-white hover:border-blue-500 transition-colors">
                        <UploadCloud size={16} /> Importar CSV SLA
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total de Projetos" value={stats.total} icon={<Package size={24}/>} colorClass="bg-blue-600" />
                <StatCard title="Média Dias na Fase" value={stats.avgDays.toFixed(1)} icon={<Clock size={24}/>} colorClass="bg-indigo-600" description="Meta: 5.0 dias" />
                <StatCard title="Em Alerta (>5d)" value={stats.warning} icon={<AlertTriangle size={24}/>} colorClass="bg-yellow-600" />
                <StatCard title="Atrasados (>7d)" value={stats.delayed} icon={<AlertTriangle size={24}/>} colorClass="bg-red-600" />
            </div>

            {projects.length > 0 && <Charts projects={projects} />}
            {projects.length > 0 && <ProjectTable projects={projects} onEmailClick={(p) => { setSelectedProject(p); setIsModalOpen(true); }} />}
            <EmailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} project={selectedProject} />
        </div>
    );
};

const SLAControlView: React.FC = () => {
    const [projects, setProjects] = useLocalStorage<MultiPhaseProject[]>('nexus_stock_multiphase_projects', []);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseMultiPhaseCSV(evt.target?.result as string);
            setProjects(parsed);
        };
        reader.readAsText(file);
    };

    const averages = useMemo(() => {
        if (!projects.length) return { triagem: 0, kickoff: 0, estoque: 0 };
        const total = projects.length;
        return {
            triagem: projects.reduce((acc, p) => acc + p.diasTriagem, 0) / total,
            kickoff: projects.reduce((acc, p) => acc + p.diasKickoff, 0) / total,
            estoque: projects.reduce((acc, p) => acc + p.diasEstoque, 0) / total,
        };
    }, [projects]);

    const chartData = [
        { name: 'Triagem', dias: parseFloat(averages.triagem.toFixed(2)), fill: '#3b82f6' },
        { name: 'Kickoff', dias: parseFloat(averages.kickoff.toFixed(2)), fill: '#8b5cf6' },
        { name: 'Estoque', dias: parseFloat(averages.estoque.toFixed(2)), fill: '#f59e0b' },
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Controle de SLA por Fase</h3>
                <div className="flex gap-4">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-nexus-800 border border-nexus-600 rounded-lg text-sm text-white hover:border-purple-500 transition-colors">
                        <UploadCloud size={16} /> Importar CSV Comparativo
                    </button>
                </div>
            </div>

            {projects.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Média Triagem" value={`${averages.triagem.toFixed(1)} dias`} icon={<span>T</span>} colorClass="bg-blue-600" />
                        <StatCard title="Média Kickoff" value={`${averages.kickoff.toFixed(1)} dias`} icon={<span>K</span>} colorClass="bg-purple-600" />
                        <StatCard title="Média Estoque" value={`${averages.estoque.toFixed(1)} dias`} icon={<span>E</span>} colorClass="bg-amber-600" />
                    </div>
                    <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
                        <h3 className="font-bold text-white mb-4">Médias por Fase</h3>
                        <div className="h-64">
                            <ResponsiveContainer>
                                <BarChart data={chartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                                    <Bar dataKey="dias" radius={[0, 4, 4, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Internal Helper Components for SLA Monitor
const EmailModal: React.FC<{ isOpen: boolean; onClose: () => void; project: SLAProject | null }> = ({ isOpen, onClose, project }) => {
    if (!isOpen || !project) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-nexus-700 pb-2">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Mail size={18} className="text-blue-400"/> Notificação</h3>
                    <button onClick={onClose} className="text-nexus-400 hover:text-white"><X size={18}/></button>
                </div>
                <div className="space-y-4">
                    <p className="text-sm text-nexus-300">Enviar alerta de atraso para o gestor responsável pelo projeto <strong>{project.titulo}</strong>.</p>
                    <button onClick={() => { alert('Simulação: Email enviado!'); onClose(); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium transition-colors">Enviar Email</button>
                </div>
            </div>
        </div>
    );
};

const Charts: React.FC<{ projects: SLAProject[] }> = ({ projects }) => {
  const statusCounts = projects.reduce((acc, curr) => {
    if (curr.diasNaFase > SLA_DAYS_CRITICAL) acc.critical++;
    else if (curr.diasNaFase > SLA_DAYS_WARNING) acc.warning++;
    else acc.ok++;
    return acc;
  }, { ok: 0, warning: 0, critical: 0 });

  const pieData = [
    { name: 'No Prazo', value: statusCounts.ok, color: COLORS.OK },
    { name: 'Atenção', value: statusCounts.warning, color: COLORS.WARNING },
    { name: 'Crítico', value: statusCounts.critical, color: COLORS.CRITICAL },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
            <h3 className="text-white font-bold mb-4">Status Geral de SLA</h3>
            <div className="h-48">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
            <h3 className="text-white font-bold mb-4">Projetos por Dias (Top 5)</h3>
            <div className="h-48">
                <ResponsiveContainer>
                    <BarChart data={projects.sort((a,b) => b.diasNaFase - a.diasNaFase).slice(0, 5)}>
                        <XAxis dataKey="titulo" hide />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                        <Bar dataKey="diasNaFase" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};

const ProjectTable: React.FC<{ projects: SLAProject[]; onEmailClick: (p: SLAProject) => void }> = ({ projects, onEmailClick }) => (
    <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
        <table className="w-full text-sm text-left">
            <thead className="bg-nexus-900/50 text-nexus-400 uppercase text-[10px] font-bold">
                <tr>
                    <th className="px-6 py-3">Projeto</th>
                    <th className="px-6 py-3">Dias na Fase</th>
                    <th className="px-6 py-3 text-right">Ação</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-nexus-700 text-nexus-300">
                {projects.map(p => {
                    const status = getSLAStatus(p.diasNaFase);
                    return (
                        <tr key={p.id} className="hover:bg-nexus-700/20">
                            <td className="px-6 py-3">
                                <p className="font-bold text-white">{p.titulo}</p>
                                <p className="text-[10px] text-nexus-500">{p.numeroProjeto}</p>
                            </td>
                            <td className="px-6 py-3">
                                <span className={`font-mono font-bold ${status === SLAStatus.CRITICAL ? 'text-red-500' : status === SLAStatus.WARNING ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {p.diasNaFase.toFixed(1)} dias
                                </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <button onClick={() => onEmailClick(p)} className="p-2 hover:text-blue-400 transition-colors"><Mail size={16}/></button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

// --- MAIN MODULE WRAPPER ---

export const StockManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'control' | 'status'>('monitor');

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Monitoramento Estoque & Compras</h2>
          <p className="text-nexus-400">SLA de Processos e Status Crítico de Materiais</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Sincronizado
            </span>
            <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700 overflow-x-auto max-w-full">
                {[
                    { id: 'monitor', label: 'SLA Projetos', icon: BarChart2 },
                    { id: 'control', label: 'Fases', icon: Layers },
                    { id: 'status', label: 'Status do Projeto', icon: ShoppingCart },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
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
      </div>

      <div className="flex-1 min-h-0">
          {activeTab === 'monitor' && <StockMonitoringView />}
          {activeTab === 'control' && <SLAControlView />}
          {activeTab === 'status' && <ProjectBuyingStatusView />}
      </div>
    </div>
  );
};
