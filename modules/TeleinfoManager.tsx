
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  LayoutDashboard, Users, FolderKanban, CalendarClock, UserX, ClipboardList,
  Plus, Trash2, MapPin, Building2, FileText, ChevronLeft, ChevronRight, User, Printer
} from 'lucide-react';
import { ManagerProject, Employee, Schedule, Absence, AbsenceType, BU, BUColorsHex } from '../types';
import { syncToSupabase, fetchFromSupabase } from '../services/supabase';

// Hook para Supabase
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

// Sub-componentes (Dashboard, Schedule, etc.) mantidos mas usando dados do Supabase via Props
const DashboardView: React.FC<{ projects: ManagerProject[], employees: Employee[], schedules: Schedule[] }> = ({ projects, employees, schedules }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 flex items-center gap-4">
          <div className="p-4 bg-blue-500/20 text-blue-400 rounded-full"><FolderKanban size={24} /></div>
          <div><p className="text-sm text-nexus-400 font-medium">Obras Ativas</p><h3 className="text-2xl font-bold text-white">{projects?.length || 0}</h3></div>
        </div>
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 flex items-center gap-4">
          <div className="p-4 bg-green-500/20 text-green-400 rounded-full"><Users size={24} /></div>
          <div><p className="text-sm text-nexus-400 font-medium">Equipe Total</p><h3 className="text-2xl font-bold text-white">{employees?.length || 0}</h3></div>
        </div>
      </div>
      <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 h-80">
        <h3 className="text-white font-bold mb-4">Volume de Alocações</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[{name: 'Total', count: schedules?.length || 0}]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{backgroundColor: '#1e293b'}} />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const TeleinfoManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [projects, setProjects] = useSupabaseData<ManagerProject[]>('manager_projects', []);
  const [employees, setEmployees] = useSupabaseData<Employee[]>('manager_employees', []);
  const [schedules, setSchedules] = useSupabaseData<Schedule[]>('manager_schedules', []);
  const [absences, setAbsences] = useSupabaseData<Absence[]>('manager_absences', []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Escala', icon: CalendarClock },
    { id: 'projects', label: 'Projetos', icon: FolderKanban },
    { id: 'employees', label: 'Equipe', icon: Users },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Teleinfo Manager</h2>
        <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-nexus-400 hover:text-white'}`}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1">
         {activeTab === 'dashboard' && <DashboardView projects={projects} employees={employees} schedules={schedules} />}
      </div>
    </div>
  );
};
