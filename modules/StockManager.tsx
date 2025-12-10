
import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend 
} from 'recharts';
import { StockItem, SLAProject, MultiPhaseProject, SLAStatus } from '../types';
import { 
  ArrowUpRight, ArrowDownRight, Package, DollarSign, UploadCloud, 
  AlertTriangle, CheckCircle, Clock, X, Mail, BarChart2, Layers
} from 'lucide-react';

// --- CONSTANTS & UTILS ---

const SLA_DAYS_WARNING = 5;
const SLA_DAYS_CRITICAL = 7;

const COLORS = {
  OK: '#22c55e',      // green-500
  WARNING: '#eab308', // yellow-500
  CRITICAL: '#ef4444' // red-500
};

// LocalStorage Hook (Duplicated here to keep module independent or could be moved to utils)
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

// CSV Parser Helper for SLA Projects
const parseProjectsCSV = (text: string): SLAProject[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: SLAProject[] = [];
    // Assuming CSV Header or specific order. Let's try to auto-detect or assume standard order
    // Expected: Titulo; Numero; DataInicio; Dias; DataEntrega
    
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

// CSV Parser Helper for Multi-Phase
const parseMultiPhaseCSV = (text: string): MultiPhaseProject[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: MultiPhaseProject[] = [];
    // Expected: Titulo; Nº Projeto; Triagem; Kickoff; Estoque
    
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

const getSLAStatus = (days: number): SLAStatus => {
  if (days > SLA_DAYS_CRITICAL) return SLAStatus.CRITICAL;
  if (days > SLA_DAYS_WARNING) return SLAStatus.WARNING;
  return SLAStatus.OK;
};

// --- COMPONENTS ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string; description?: string }> = ({ title, value, icon, colorClass, description }) => {
  return (
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
};

const EmailModal: React.FC<{ isOpen: boolean; onClose: () => void; project: SLAProject | null }> = ({ isOpen, onClose, project }) => {
    if (!isOpen || !project) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-nexus-800 border border-nexus-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-nexus-700 pb-2">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Mail size={18} className="text-blue-400"/> Enviar Cobrança
                    </h3>
                    <button onClick={onClose} className="text-nexus-400 hover:text-white"><X size={18}/></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-nexus-900/50 p-3 rounded-lg border border-nexus-700">
                        <p className="text-xs text-nexus-400">Projeto</p>
                        <p className="text-white font-medium">{project.titulo}</p>
                        <p className="text-xs text-red-400 mt-1">Dias na fase: {project.diasNaFase}</p>
                    </div>
                    <div>
                        <label className="text-xs text-nexus-400 mb-1 block">Destinatário</label>
                        <input type="email" className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white text-sm" placeholder="gestor@exemplo.com" />
                    </div>
                    <div>
                        <label className="text-xs text-nexus-400 mb-1 block">Mensagem</label>
                        <textarea className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white text-sm" rows={3} defaultValue={`Olá, o projeto ${project.numeroProjeto} está com ${project.diasNaFase} dias nesta fase. Por favor, verificar.`}></textarea>
                    </div>
                    <button onClick={() => { alert('Email enviado (simulação)'); onClose(); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium transition-colors">
                        Enviar Notificação
                    </button>
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
    { name: 'No Prazo (<=5d)', value: statusCounts.ok, color: COLORS.OK },
    { name: 'Atenção (>5d)', value: statusCounts.warning, color: COLORS.WARNING },
    { name: 'Atrasado (>7d)', value: statusCounts.critical, color: COLORS.CRITICAL },
  ].filter(d => d.value > 0);

  const barData = [...projects]
    .sort((a, b) => b.diasNaFase - a.diasNaFase)
    .slice(0, 10)
    .map(p => ({
      name: p.titulo.length > 20 ? p.titulo.substring(0, 20) + '...' : p.titulo,
      days: p.diasNaFase,
      fullTitle: p.titulo
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
        <h3 className="text-lg font-bold text-white mb-4">Top 10 - Mais Tempo na Fase</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 11, fill: '#94a3b8'}} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
                formatter={(value: number) => [`${value.toFixed(1)} dias`, 'Tempo']}
              />
              <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={
                    entry.days > SLA_DAYS_CRITICAL ? COLORS.CRITICAL : 
                    entry.days > SLA_DAYS_WARNING ? COLORS.WARNING : COLORS.OK
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
        <h3 className="text-lg font-bold text-white mb-4">Distribuição por Status SLA</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const ProjectTable: React.FC<{ projects: SLAProject[]; onEmailClick: (p: SLAProject) => void }> = ({ projects, onEmailClick }) => {
  const [filter, setFilter] = useState<'ALL' | 'DELAYED' | 'WARNING'>('ALL');

  const filteredProjects = projects.filter(p => {
    const status = getSLAStatus(p.diasNaFase);
    if (filter === 'DELAYED') return status === SLAStatus.CRITICAL;
    if (filter === 'WARNING') return status === SLAStatus.WARNING;
    return true;
  });

  const counts = {
      warning: projects.filter(p => getSLAStatus(p.diasNaFase) === SLAStatus.WARNING).length,
      critical: projects.filter(p => getSLAStatus(p.diasNaFase) === SLAStatus.CRITICAL).length,
      total: projects.length
  };

  return (
    <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
      <div className="p-5 border-b border-nexus-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h3 className="text-lg font-bold text-white">Detalhamento dos Projetos</h3>
        <div className="flex bg-nexus-900 p-1 rounded-lg">
          {[
              { id: 'ALL', label: 'Todos', count: counts.total, color: 'text-nexus-300' },
              { id: 'WARNING', label: 'Atenção', count: counts.warning, color: 'text-yellow-400' },
              { id: 'DELAYED', label: 'Atrasados', count: counts.critical, color: 'text-red-400' }
          ].map(opt => (
              <button key={opt.id} onClick={() => setFilter(opt.id as any)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filter === opt.id ? 'bg-nexus-700 text-white shadow-sm' : 'text-nexus-500 hover:text-nexus-300'}`}>
                  {opt.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-nexus-800 ${opt.color}`}>{opt.count}</span>
              </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-nexus-300">
          <thead className="bg-nexus-900/50 text-nexus-400 uppercase font-medium text-xs">
            <tr>
              <th className="px-6 py-4">Projetos</th>
              <th className="px-6 py-4">Início na Fase</th>
              <th className="px-6 py-4 text-center">Dias na Fase</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nexus-700">
            {filteredProjects.map((project) => {
              const status = getSLAStatus(project.diasNaFase);
              return (
                <tr key={project.id} className="hover:bg-nexus-700/30 transition-colors">
                  <td className="px-6 py-4">
                      <div className="font-medium text-white truncate max-w-xs" title={project.titulo}>{project.titulo}</div>
                      <div className="text-xs text-nexus-500">{project.numeroProjeto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {project.inicioFase}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-md font-bold text-sm ${
                      status === SLAStatus.CRITICAL ? 'bg-red-500/10 text-red-400' :
                      status === SLAStatus.WARNING ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {project.diasNaFase.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                     {status === SLAStatus.CRITICAL && <span className="text-xs font-bold text-red-500 uppercase">Crítico</span>}
                     {status === SLAStatus.WARNING && <span className="text-xs font-bold text-yellow-500 uppercase">Atenção</span>}
                     {status === SLAStatus.OK && <span className="text-xs font-bold text-green-500 uppercase">No Prazo</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onEmailClick(project)} className="text-nexus-400 hover:text-blue-400 p-2 rounded-full hover:bg-blue-500/10" title="Enviar Email">
                      <Mail size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredProjects.length === 0 && <div className="p-8 text-center text-nexus-500">Nenhum projeto encontrado.</div>}
      </div>
    </div>
  );
};

// --- SUB-VIEWS ---

const StockMonitoringView: React.FC = () => {
    // Replaced useState with useLocalStorage to persist data
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
                        <UploadCloud size={16} /> Importar CSV
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total de Projetos" value={stats.total} icon={<Package size={24}/>} colorClass="bg-blue-600" />
                <StatCard title="Média Dias na Fase" value={stats.avgDays.toFixed(1)} icon={<Clock size={24}/>} colorClass="bg-indigo-600" description="Meta: 5.0 dias" />
                <StatCard title="Em Alerta (>5d)" value={stats.warning} icon={<AlertTriangle size={24}/>} colorClass="bg-yellow-600" />
                <StatCard title="Atrasados (>7d)" value={stats.delayed} icon={<AlertTriangle size={24}/>} colorClass="bg-red-600" />
            </div>

            {projects.length > 0 ? (
                <>
                    <Charts projects={projects} />
                    <ProjectTable projects={projects} onEmailClick={(p) => { setSelectedProject(p); setIsModalOpen(true); }} />
                </>
            ) : (
                <div className="bg-nexus-800 border border-dashed border-nexus-600 rounded-xl p-12 text-center text-nexus-400">
                    <UploadCloud size={48} className="mx-auto mb-4 opacity-50"/>
                    <p>Importe um arquivo CSV (Titulo; Numero; Inicio; Dias; Entrega) para visualizar os dados.</p>
                </div>
            )}
            <EmailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} project={selectedProject} />
        </div>
    );
};

const SLAControlView: React.FC = () => {
    // Replaced useState with useLocalStorage to persist data
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

    const topProjects = [...projects].sort((a, b) => 
        (b.diasTriagem + b.diasKickoff + b.diasEstoque) - (a.diasTriagem + a.diasKickoff + a.diasEstoque)
    ).slice(0, 10);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Controle de SLA por Fase</h3>
                <div className="flex gap-4">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-nexus-800 border border-nexus-600 rounded-lg text-sm text-white hover:border-purple-500 transition-colors">
                        <UploadCloud size={16} /> Importar CSV SLA
                    </button>
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="bg-nexus-800 border border-dashed border-nexus-600 rounded-xl p-12 text-center text-nexus-400">
                    <Layers size={48} className="mx-auto mb-4 opacity-50"/>
                    <p>Importe um CSV (Titulo; Projeto; Triagem; Kickoff; Estoque) para comparar fases.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Média Triagem" value={`${averages.triagem.toFixed(1)} dias`} icon={<span className="font-bold">T</span>} colorClass="bg-blue-600" />
                        <StatCard title="Média Kickoff" value={`${averages.kickoff.toFixed(1)} dias`} icon={<span className="font-bold">K</span>} colorClass="bg-purple-600" />
                        <StatCard title="Média Estoque" value={`${averages.estoque.toFixed(1)} dias`} icon={<span className="font-bold">E</span>} colorClass="bg-amber-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
                            <h3 className="font-bold text-white mb-4">Média por Fase</h3>
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

                        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
                            <h3 className="font-bold text-white mb-4">Top 10 Mais Longos (Total)</h3>
                            <div className="h-64">
                                <ResponsiveContainer>
                                    <BarChart data={topProjects}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="titulo" stroke="#94a3b8" tick={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                                        <Bar dataKey="diasTriagem" stackId="a" fill="#3b82f6" />
                                        <Bar dataKey="diasKickoff" stackId="a" fill="#8b5cf6" />
                                        <Bar dataKey="diasEstoque" stackId="a" fill="#f59e0b" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const PhysicalStockView: React.FC = () => {
    // Demo Data
    const DATA: StockItem[] = [
      { id: '1', name: 'Switch 24p', category: 'Network', quantity: 45, minLevel: 10, price: 1200 },
      { id: '2', name: 'Cabo CAT6 (300m)', category: 'Cabling', quantity: 12, minLevel: 15, price: 450 },
      { id: '3', name: 'Roteador Wi-Fi 6', category: 'Network', quantity: 28, minLevel: 10, price: 890 },
      { id: '4', name: 'Server Rack 42U', category: 'Infra', quantity: 3, minLevel: 2, price: 3500 },
      { id: '5', name: 'No-Break 2000VA', category: 'Power', quantity: 8, minLevel: 5, price: 1800 },
    ];
    const totalValue = DATA.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const lowStockCount = DATA.filter(item => item.quantity < item.minLevel).length;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Valor em Estoque" value={`R$ ${totalValue.toLocaleString()}`} icon={<DollarSign size={20}/>} colorClass="bg-green-600" />
                <StatCard title="Itens Críticos" value={lowStockCount} icon={<ArrowDownRight size={20}/>} colorClass="bg-red-600" />
                <StatCard title="Total SKU" value={DATA.length} icon={<Package size={20}/>} colorClass="bg-blue-600" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
                    <h3 className="font-semibold text-white mb-6">Distribuição</h3>
                    <div className="h-64">
                        <ResponsiveContainer>
                            <BarChart data={DATA}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} />
                                <Bar dataKey="quantity" fill="#3b82f6">
                                    {DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.quantity < entry.minLevel ? '#ef4444' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
                    <table className="w-full text-left text-sm text-nexus-300">
                        <thead className="bg-nexus-900/50 text-nexus-400">
                            <tr><th className="px-6 py-3">Item</th><th className="px-6 py-3">Qtd.</th><th className="px-6 py-3">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-nexus-700">
                            {DATA.map(item => (
                                <tr key={item.id}>
                                    <td className="px-6 py-3">{item.name}</td>
                                    <td className="px-6 py-3">{item.quantity}</td>
                                    <td className="px-6 py-3">{item.quantity < item.minLevel ? <span className="text-red-400 border border-red-500/30 px-2 py-1 rounded text-xs">Comprar</span> : <span className="text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs">OK</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- MAIN MODULE WRAPPER ---

export const StockManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'control' | 'physical'>('monitor');

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Monitoramento Estoque e Compras</h2>
          <p className="text-nexus-400">Gestão de SLA de Projetos e Inventário Físico</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Online
            </span>
            <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700">
                {[
                    { id: 'monitor', label: 'Monitoramento SLA', icon: BarChart2 },
                    { id: 'control', label: 'Controle Fases', icon: Layers },
                    { id: 'physical', label: 'Almoxarifado', icon: Package },
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
      </div>

      <div className="flex-1 min-h-0">
          {activeTab === 'monitor' && <StockMonitoringView />}
          {activeTab === 'control' && <SLAControlView />}
          {activeTab === 'physical' && <PhysicalStockView />}
      </div>
    </div>
  );
};
