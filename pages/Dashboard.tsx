
import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TeleinfoReport } from '../modules/TeleinfoReport';
import { StockManager } from '../modules/StockManager';
import { TeleinfoManager } from '../modules/TeleinfoManager';
import { UserManagement } from '../modules/UserManagement';
import { AppModule, UserRole, DetailedProject, ProjectBuyingStatus } from '../types';
import { 
  Menu, Zap, ShieldCheck, Target, Layers, ShoppingCart, Activity, AlertTriangle, 
  Clock, TrendingUp, Timer, ChevronRight 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchFromSupabase } from '../services/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// --- Dashboard Summary Components ---

const SummaryCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: any; color: string; trend?: string }> = ({ title, value, subValue, icon: Icon, color, trend }) => (
  <div className="bg-nexus-800 p-5 rounded-2xl border border-nexus-700 shadow-xl hover:border-nexus-600 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-20 text-white`}>
        <Icon className={color.replace('bg-', 'text-')} size={20} />
      </div>
      {trend && <span className="text-[10px] font-black text-green-400 bg-green-400/10 px-2 py-1 rounded-full">{trend}</span>}
    </div>
    <p className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">{title}</p>
    <div className="flex items-baseline gap-2 mt-1">
      <h3 className="text-3xl font-black text-white">{value}</h3>
      {subValue && <span className="text-xs text-nexus-400 font-medium">{subValue}</span>}
    </div>
  </div>
);

interface LandingDashboardProps {
  onNavigate: (mod: AppModule) => void;
  generalProjects: any[];
  buyingStatus: ProjectBuyingStatus[];
  detailedAudits: DetailedProject[];
}

const LandingDashboard: React.FC<LandingDashboardProps> = ({ onNavigate, generalProjects, buyingStatus, detailedAudits }) => {
  // Memolized metrics
  const projectStats = useMemo(() => {
    const total = generalProjects.length;
    const avg = total > 0 ? (generalProjects.reduce((acc, p) => acc + (p.perc || 0), 0) / total).toFixed(0) : 0;
    const notStarted = generalProjects.filter(p => {
      const s = p.status?.toUpperCase() || '';
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("NAO INICIADO");
    }).length;
    return { total, avg, notStarted };
  }, [generalProjects]);

  const buyingStats = useMemo(() => {
    const critical = buyingStatus.filter(p => p.status === 'Crítico').length;
    const total = buyingStatus.length;
    return { critical, total };
  }, [buyingStatus]);

  const auditStats = useMemo(() => {
    const totalSold = detailedAudits.reduce((acc, p) => acc + (p.soldHours?.infra || 0) + (p.soldHours?.sse || 0) + (p.soldHours?.ti || 0), 0);
    const totalUsed = detailedAudits.reduce((acc, p) => acc + (p.usedHours?.infra || 0) + (p.usedHours?.sse || 0) + (p.usedHours?.ti || 0), 0);
    const criticalHH = detailedAudits.filter(p => {
      const sold = (p.soldHours?.infra || 0) + (p.soldHours?.sse || 0) + (p.soldHours?.ti || 0);
      const used = (p.usedHours?.infra || 0) + (p.usedHours?.sse || 0) + (p.usedHours?.ti || 0);
      return sold > 0 && used > sold;
    }).length;
    return { totalSold, totalUsed, criticalHH };
  }, [detailedAudits]);

  return (
    <div className="space-y-10 animate-fadeIn pb-20">
      
      {/* SECTION 1: VISÃO GERAL DE PROJETOS */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <Layers className="text-blue-500" /> Visão Geral de Projetos
            </h2>
            <p className="text-nexus-400 text-sm">Status e performance global da carteira</p>
          </div>
          <button onClick={() => onNavigate(AppModule.TELEINFO_REPORT)} className="text-blue-400 hover:text-blue-300 text-xs font-black uppercase flex items-center gap-1 group">
            Ver Relatório Completo <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard title="Projetos Mapeados" value={projectStats.total} subValue="Ativos" icon={Layers} color="bg-blue-600" />
          <SummaryCard title="Conclusão Média" value={`${projectStats.avg}%`} subValue="Global" icon={Target} color="bg-purple-600" />
          <SummaryCard title="Não Iniciados" value={projectStats.notStarted} subValue="Aguardando" icon={Clock} color="bg-orange-600" />
        </div>
      </section>

      {/* SECTION 2: STATUS DE COMPRAS */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <ShoppingCart className="text-nexus-warning" /> Status de Compras
            </h2>
            <p className="text-nexus-400 text-sm">Controle de criticidade e aquisição de materiais</p>
          </div>
          <button onClick={() => onNavigate(AppModule.STOCK_MONITOR)} className="text-blue-400 hover:text-blue-300 text-xs font-black uppercase flex items-center gap-1 group">
            Ver Gestão de Compras <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="bg-nexus-800 rounded-2xl border border-nexus-700 p-6 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-4 w-full">
            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={24} />
                <div>
                  <p className="text-white font-black text-lg">{buyingStats.critical}</p>
                  <p className="text-red-400 text-[10px] font-black uppercase">Projetos em Estado Crítico</p>
                </div>
              </div>
              <TrendingUp className="text-red-500 opacity-20" size={40} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-nexus-900/50 p-4 rounded-xl border border-nexus-700">
                  <p className="text-2xl font-black text-white">{buyingStats.total}</p>
                  <p className="text-nexus-500 text-[9px] font-black uppercase">Total de Itens Monitorados</p>
               </div>
               <div className="bg-nexus-900/50 p-4 rounded-xl border border-nexus-700">
                  <p className="text-2xl font-black text-green-500">{buyingStats.total - buyingStats.critical}</p>
                  <p className="text-nexus-500 text-[9px] font-black uppercase">Em Fluxo Normal</p>
               </div>
            </div>
          </div>
          <div className="h-40 w-40 shrink-0">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                  <Pie
                    data={[
                      { name: 'Crítico', value: buyingStats.critical },
                      { name: 'OK', value: Math.max(0, buyingStats.total - buyingStats.critical) }
                    ]}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#ef4444" stroke="none" />
                    <Cell fill="#1e293b" stroke="#334155" />
                  </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="text-center -mt-24">
               <p className="text-xl font-black text-white">{buyingStats.total > 0 ? ((buyingStats.critical / buyingStats.total) * 100).toFixed(0) : 0}%</p>
               <p className="text-[8px] text-nexus-500 font-black uppercase">Críticos</p>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: AUDITORIA DETALHADA */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <Activity className="text-green-400" /> Auditoria Detalhada
            </h2>
            <p className="text-nexus-400 text-sm">Acompanhamento de H/H (Hora-Homem) por obra</p>
          </div>
          <button onClick={() => onNavigate(AppModule.TELEINFO_REPORT)} className="text-blue-400 hover:text-blue-300 text-xs font-black uppercase flex items-center gap-1 group">
            Abrir Auditoria <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-nexus-800 p-6 rounded-2xl border border-nexus-700">
            <h4 className="text-nexus-400 font-black text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
              <Timer size={14} className="text-blue-400" /> Consumo de Horas (Vendido x Utilizado)
            </h4>
            <div className="flex items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black text-nexus-500 uppercase">
                    <span>Vendido</span>
                    <span className="text-white">{auditStats.totalSold}h</span>
                  </div>
                  <div className="w-full bg-nexus-900 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-nexus-700" style={{ width: '100%' }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black text-nexus-500 uppercase">
                    <span>Utilizado</span>
                    <span className={auditStats.totalUsed > auditStats.totalSold ? 'text-red-400' : 'text-green-400'}>{auditStats.totalUsed}h</span>
                  </div>
                  <div className="w-full bg-nexus-900 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${auditStats.totalUsed > auditStats.totalSold ? 'bg-red-500' : 'bg-green-500'}`} 
                         style={{ width: `${Math.min(100, auditStats.totalSold > 0 ? (auditStats.totalUsed / auditStats.totalSold) * 100 : 0)}%` }} />
                  </div>
                </div>
              </div>
              <div className="text-center p-4 bg-nexus-900/50 rounded-2xl border border-nexus-700 min-w-[100px]">
                <p className="text-2xl font-black text-white">{auditStats.totalSold > 0 ? ((auditStats.totalUsed / auditStats.totalSold) * 100).toFixed(1) : 0}%</p>
                <p className="text-[8px] text-nexus-500 font-black uppercase">Utilização</p>
              </div>
            </div>
            {auditStats.criticalHH > 0 && (
              <div className="mt-6 flex items-center gap-2 text-xs font-black text-red-400 bg-red-400/10 p-2 rounded-lg">
                <AlertTriangle size={14} /> {auditStats.criticalHH} Obras com orçamento de horas estourado!
              </div>
            )}
          </div>

          <div className="bg-nexus-800 p-6 rounded-2xl border border-nexus-700">
             <h4 className="text-nexus-400 font-black text-[10px] uppercase tracking-widest mb-4">Últimas Auditorias Ativas</h4>
             <div className="space-y-3">
               {detailedAudits.slice(0, 4).map(p => (
                 <div key={p.id} className="flex items-center justify-between p-3 bg-nexus-900/50 rounded-xl border border-nexus-700 hover:bg-nexus-700/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-6 rounded-full bg-blue-500" />
                       <div>
                          <p className="text-xs font-bold text-white uppercase">{p.name}</p>
                          <p className="text-[9px] text-nexus-500 uppercase">CC: {p.costCenter}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-white">{p.steps.length > 0 ? (p.steps.reduce((acc, s) => acc + s.perc, 0) / p.steps.length).toFixed(0) : 0}%</p>
                       <p className="text-[8px] text-nexus-500 font-black uppercase">Progresso</p>
                    </div>
                 </div>
               ))}
               {detailedAudits.length === 0 && <p className="text-nexus-600 italic text-xs py-8 text-center">Nenhuma auditoria cadastrada.</p>}
             </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export const Dashboard: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<AppModule>(AppModule.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  // Lifted state for the landing dashboard to avoid re-fetching on every tab switch
  const [generalProjects, setGeneralProjects] = useState<any[]>([]);
  const [buyingStatus, setBuyingStatus] = useState<ProjectBuyingStatus[]>([]);
  const [detailedAudits, setDetailedAudits] = useState<DetailedProject[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [gp, bs, da] = await Promise.all([
          fetchFromSupabase<any>('general_projects'),
          fetchFromSupabase<ProjectBuyingStatus>('buying_status'),
          fetchFromSupabase<DetailedProject>('detailed_projects')
        ]);
        if (gp) setGeneralProjects(gp);
        if (bs) setBuyingStatus(bs);
        if (da) setDetailedAudits(da);
      } finally {
        setDataLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const renderModule = () => {
    switch (currentModule) {
      case AppModule.TELEINFO_REPORT:
        return <TeleinfoReport />;
      case AppModule.STOCK_MONITOR:
        return <StockManager />;
      case AppModule.TELEINFO_MANAGER:
        return <TeleinfoManager />;
      case AppModule.USER_MANAGEMENT:
        return <UserManagement />;
      case AppModule.DASHBOARD:
      default:
        if (dataLoading) {
            return (
              <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-nexus-400 font-bold animate-pulse uppercase text-xs tracking-widest">Sincronizando Plataforma Nexus...</p>
              </div>
            );
        }
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-3xl font-black text-white">Dashboard Nexus</h2>
                <p className="text-nexus-400 text-sm">Bem-vindo à central de inteligência Teleinfo.</p>
              </div>
              <div className="hidden md:flex items-center gap-4 p-2 bg-nexus-800 rounded-2xl border border-nexus-700">
                <div className="text-right">
                  <p className="text-[10px] font-black text-nexus-500 uppercase leading-none">Status Conexão</p>
                  <p className="text-green-500 text-xs font-black">Supabase Cloud On</p>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_#10b981]" />
              </div>
            </div>
            
            <LandingDashboard 
              onNavigate={setCurrentModule} 
              generalProjects={generalProjects}
              buyingStatus={buyingStatus}
              detailedAudits={detailedAudits}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-nexus-900 overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <Sidebar 
        currentModule={currentModule} 
        onNavigate={(mod) => {
          setCurrentModule(mod);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="h-16 flex items-center justify-between px-4 border-b border-nexus-700 bg-nexus-900/90 backdrop-blur shrink-0 z-20">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-nexus-400 hover:bg-nexus-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{user?.name}</span>
              <span className="text-[10px] text-nexus-500 font-black uppercase">{user?.role}</span>
            </div>
            <img src={user?.avatar} alt="Profile" className="w-8 h-8 rounded-full border border-nexus-600 shadow-lg shrink-0" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
};
