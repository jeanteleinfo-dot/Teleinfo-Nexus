
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TeleinfoReport } from '../modules/TeleinfoReport';
import { StockManager } from '../modules/StockManager';
import { TeleinfoManager } from '../modules/TeleinfoManager';
import { OperationalScale } from '../modules/OperationalScale';
import { UserManagement } from '../modules/UserManagement';
import { AppModule, UserRole, DetailedProject, ProjectBuyingStatus } from '../types';
import { 
  Menu, Zap, ShieldCheck, Target, Layers, ShoppingCart, Activity, AlertTriangle, 
  Clock, TrendingUp, Timer, ChevronRight, Loader2, RefreshCw 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchFromSupabase, useSupabaseData } from '../services/supabase';
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
  const projectStats = useMemo(() => {
    const total = generalProjects.length;
    let totalPerc = 0;
    let notStarted = 0;
    generalProjects.forEach(p => {
      totalPerc += (p.perc || 0);
      const s = p.status?.toUpperCase() || '';
      if (s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("NAO INICIADO")) notStarted++;
    });
    const avg = total > 0 ? (totalPerc / total).toFixed(0) : 0;
    return { total, avg, notStarted };
  }, [generalProjects]);

  const buyingStats = useMemo(() => {
    const critical = buyingStatus.filter(p => p.status === 'Crítico').length;
    const total = buyingStatus.length;
    return { critical, total };
  }, [buyingStatus]);

  const auditStats = useMemo(() => {
    let totalSold = 0;
    let totalUsed = 0;
    let criticalHH = 0;
    detailedAudits.forEach(p => {
      const sold = (p.soldHours?.infra || 0) + (p.soldHours?.sse || 0) + (p.soldHours?.ti || 0);
      const used = (p.usedHours?.infra || 0) + (p.usedHours?.sse || 0) + (p.usedHours?.ti || 0);
      totalSold += sold;
      totalUsed += used;
      if (sold > 0 && used > sold) criticalHH++;
    });
    return { totalSold, totalUsed, criticalHH };
  }, [detailedAudits]);

  return (
    <div className="space-y-10 animate-fadeIn pb-20">
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
          </div>
          <div className="h-40 w-40 shrink-0 flex items-center justify-center relative">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                  <Pie
                    data={[{ name: 'C', value: buyingStats.critical }, { name: 'O', value: Math.max(1, buyingStats.total - buyingStats.critical) }]}
                    innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value" stroke="none"
                  >
                    <Cell fill="#ef4444" />
                    <Cell fill="#1e293b" />
                  </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <p className="text-xl font-black text-white leading-none">{buyingStats.total > 0 ? ((buyingStats.critical / buyingStats.total) * 100).toFixed(0) : 0}%</p>
               <p className="text-[8px] text-nexus-500 font-black uppercase">Críticos</p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [currentModule, setCurrentModule] = useState<AppModule>(AppModule.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [generalProjects, , reloadGeneral] = useSupabaseData<any[]>('general_projects', []);
  const [buyingStatus, , reloadBuying] = useSupabaseData<ProjectBuyingStatus[]>('buying_status', []);
  const [detailedAudits, , reloadDetailed] = useSupabaseData<DetailedProject[]>('detailed_projects', []);
  const [dataLoading, setDataLoading] = useState(false);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    await Promise.all([
      reloadGeneral(),
      reloadBuying(),
      reloadDetailed()
    ]);
    setDataLoading(false);
  }, [reloadGeneral, reloadBuying, reloadDetailed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderModule = () => {
    switch (currentModule) {
      case AppModule.TELEINFO_REPORT: return <TeleinfoReport />;
      case AppModule.STOCK_MONITOR: return <StockManager />;
      case AppModule.TELEINFO_MANAGER: return <TeleinfoManager />;
      case AppModule.OPERATIONAL_SCALE: return <OperationalScale />;
      case AppModule.USER_MANAGEMENT: return <UserManagement />;
      case AppModule.DASHBOARD:
      default:
        if (dataLoading && generalProjects.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-nexus-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Plataforma Nexus...</p>
              </div>
            );
        }
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter">Dashboard Nexus</h2>
                <p className="text-nexus-400 text-sm">Central de inteligência operacional Teleinfo.</p>
              </div>
              <div className="hidden md:flex items-center gap-4 p-2 bg-nexus-800 rounded-2xl border border-nexus-700">
                <div className="text-right">
                  <p className="text-[10px] font-black text-nexus-500 uppercase leading-none">Status</p>
                  <p className="text-green-500 text-xs font-black">Cloud Online</p>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_#10b981]" />
                <button onClick={loadData} className="p-1 text-nexus-500 hover:text-white"><RefreshCw size={14}/></button>
              </div>
            </div>
            <LandingDashboard onNavigate={setCurrentModule} generalProjects={generalProjects} buyingStatus={buyingStatus} detailedAudits={detailedAudits} />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-nexus-900 overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm no-print" onClick={() => setSidebarOpen(false)} />}
      <div className="no-print">
        <Sidebar currentModule={currentModule} onNavigate={(mod) => { setCurrentModule(mod); if (window.innerWidth < 768) setSidebarOpen(false); }} isOpen={sidebarOpen} />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="h-16 flex items-center justify-between px-6 border-b border-nexus-700 bg-nexus-900/95 backdrop-blur shrink-0 z-20 no-print">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-nexus-400 hover:bg-nexus-800 rounded-xl transition-all"><Menu size={24} /></button>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white">{user?.name}</p>
              <p className="text-[9px] text-nexus-500 font-black uppercase tracking-widest">{user?.role}</p>
            </div>
            <img src={user?.avatar} alt="P" className="w-9 h-9 rounded-full border border-nexus-600 shadow-xl" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar bg-nexus-900">
          <div className="max-w-7xl mx-auto">{renderModule()}</div>
        </main>
      </div>
    </div>
  );
};
