
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  LayoutDashboard, Users, FolderKanban, CalendarClock, UserX, ClipboardList,
  Plus, Trash2, Edit2, Search, MapPin, Building2, FileText, Clock, Car, 
  ChevronLeft, ChevronRight, Printer, User, Mail
} from 'lucide-react';
import { 
  ManagerProject, Employee, Schedule, Absence, AbsenceType, BU, BUColorsClass, BUColorsHex 
} from '../types';

// --- MOCK DATA ---

const INITIAL_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Carlos Silva', role: 'Técnico Líder' },
  { id: '2', name: 'Roberto Santos', role: 'Instalador' },
  { id: '3', name: 'Amanda Oliveira', role: 'Engenheira' },
  { id: '4', name: 'Jorge Costa', role: 'Auxiliar' },
  { id: '5', name: 'Fernanda Lima', role: 'Técnica' },
];

const INITIAL_PROJECTS: ManagerProject[] = [
  { 
    id: 'p1', name: 'Data Center Alpha', costCenter: '10.01.01', osNumber: 'OS-9001', 
    client: 'Banco Nacional', location: 'SP Capital', bu: BU.BUTI, 
    hoursSold: 200, employeesSold: 4, address: 'Av. Paulista, 1000', color: 'bg-blue-500' 
  },
  { 
    id: 'p2', name: 'Cabeamento Estruturado', costCenter: '10.02.05', osNumber: 'OS-9002', 
    client: 'Indústria Metalúrgica', location: 'ABC', bu: BU.BUINFRA, 
    hoursSold: 150, employeesSold: 3, address: 'Rua das Indústrias, 500', color: 'bg-orange-500' 
  },
  { 
    id: 'p3', name: 'CFTV Expansão', costCenter: '10.03.10', osNumber: 'OS-9003', 
    client: 'Shopping Center', location: 'Zona Sul', bu: BU.BUSSE, 
    hoursSold: 80, employeesSold: 2, address: 'Av. Nações Unidas, 2000', color: 'bg-green-500' 
  },
];

const INITIAL_SCHEDULES: Schedule[] = [];
const INITIAL_ABSENCES: Absence[] = [];

// --- SUB-COMPONENTS ---

// 1. DASHBOARD VIEW
const DashboardView: React.FC<{ projects: ManagerProject[], employees: Employee[], schedules: Schedule[] }> = ({ projects, employees, schedules }) => {
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const today = new Date();
  const startOfWeek = getStartOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    };
  });

  const chartData = weekDays.map(dayInfo => {
    const dataPoint: any = { name: dayInfo.dayName, date: dayInfo.date };
    const daySchedules = schedules.filter(s => s.date === dayInfo.date);
    projects.forEach(p => {
      const count = daySchedules.filter(s => s.projectId === p.id).length;
      if (count > 0) dataPoint[p.name] = count;
    });
    return dataPoint;
  });

  const buDataRaw = projects.reduce((acc, curr) => {
    acc[curr.bu] = (acc[curr.bu] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const buChartData = Object.entries(buDataRaw).map(([key, value]) => ({ name: key, value }));

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 flex items-center gap-4">
          <div className="p-4 bg-blue-500/20 text-blue-400 rounded-full"><FolderKanban size={24} /></div>
          <div><p className="text-sm text-nexus-400 font-medium">Obras Ativas</p><h3 className="text-2xl font-bold text-white">{projects.length}</h3></div>
        </div>
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 flex items-center gap-4">
          <div className="p-4 bg-green-500/20 text-green-400 rounded-full"><Users size={24} /></div>
          <div><p className="text-sm text-nexus-400 font-medium">Alocações (Semana)</p><h3 className="text-2xl font-bold text-white">{schedules.filter(s => s.date >= weekDays[0].date && s.date <= weekDays[6].date).length}</h3></div>
        </div>
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 flex items-center gap-4">
          <div className="p-4 bg-orange-500/20 text-orange-400 rounded-full"><MapPin size={24} /></div>
          <div><p className="text-sm text-nexus-400 font-medium">Locais</p><h3 className="text-2xl font-bold text-white">{new Set(projects.map(p => p.location)).size}</h3></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-nexus-800 p-6 rounded-xl border border-nexus-700">
          <h3 className="text-lg font-bold text-white mb-6">Alocação Semanal por Obra</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc'}} />
                <Legend />
                {projects.slice(0, 5).map((project) => (
                  <Bar key={project.id} dataKey={project.name} stackId="a" fill={BUColorsHex[project.bu]} name={project.client} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700">
          <h3 className="text-lg font-bold text-white mb-6">Projetos por BU</h3>
          <div className="h-64">
             <ResponsiveContainer>
                <PieChart>
                  <Pie data={buChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {buChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={BUColorsHex[entry.name] || '#8884d8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc'}} />
                  <Legend verticalAlign="bottom" />
                </PieChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. SCHEDULE VIEW
const ScheduleView: React.FC<{ projects: ManagerProject[], employees: Employee[], schedules: Schedule[], setSchedules: any, absences: Absence[] }> = ({ projects, employees, schedules, setSchedules, absences }) => {
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedProjId, setSelectedProjId] = useState('');
  const [vehicle, setVehicle] = useState('VT');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState(new Date());

  const selectedProject = projects.find(p => p.id === selectedProjId);

  const getAbsence = (dateStr: string, empId: string) => {
    if (!empId) return undefined;
    return absences.find(a => dateStr >= a.startDate && dateStr <= a.endDate && a.employeeId === empId);
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1);
    return { dateStr: d.toISOString().split('T')[0], dayNum: i + 1, isWeekend: d.getDay() === 0 || d.getDay() === 6 };
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedProjId || selectedDates.length === 0) return alert("Preencha todos os campos e selecione dias.");
    const newSchedules = selectedDates.map(date => ({
      id: Math.random().toString(36).substr(2, 9),
      date, projectId: selectedProjId, employeeId: selectedEmpId, vehicle, startTime, endTime, osNumber: selectedProject?.osNumber
    }));
    setSchedules((prev: Schedule[]) => [...prev.filter(s => !(s.employeeId === selectedEmpId && selectedDates.includes(s.date))), ...newSchedules]);
    setSelectedDates([]);
    alert("Escala salva!");
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn">
      <div className="xl:col-span-1 space-y-6">
        <form onSubmit={handleSave} className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 space-y-4">
          <h3 className="font-bold text-lg text-white mb-4 border-b border-nexus-700 pb-2">Nova Alocação</h3>
          <div>
            <label className="text-xs text-nexus-400">Colaborador</label>
            <select className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" value={selectedEmpId} onChange={e => { setSelectedEmpId(e.target.value); setSelectedDates([]); }}>
              <option value="">Selecione...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-nexus-400">Obra</label>
            <select className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" value={selectedProjId} onChange={e => setSelectedProjId(e.target.value)}>
              <option value="">Selecione...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-nexus-400">Início</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white"/></div>
            <div><label className="text-xs text-nexus-400">Fim</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white"/></div>
          </div>
          <div><label className="text-xs text-nexus-400">Veículo</label><input type="text" value={vehicle} onChange={e => setVehicle(e.target.value)} className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white"/></div>
          
          <div className="bg-nexus-900/50 p-3 rounded-xl border border-nexus-700">
             <div className="flex justify-between items-center mb-2">
               <button type="button" onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="text-white"><ChevronLeft/></button>
               <span className="text-white font-bold">{viewDate.toLocaleDateString('pt-BR', {month:'long', year:'numeric'})}</span>
               <button type="button" onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="text-white"><ChevronRight/></button>
             </div>
             <div className="grid grid-cols-7 gap-1">
               {calendarDays.map(day => {
                 const isAbsent = !!getAbsence(day.dateStr, selectedEmpId);
                 const isSelected = selectedDates.includes(day.dateStr);
                 return (
                   <button key={day.dateStr} type="button" disabled={isAbsent} onClick={() => setSelectedDates(prev => prev.includes(day.dateStr) ? prev.filter(d => d !== day.dateStr) : [...prev, day.dateStr])}
                     className={`aspect-square rounded text-xs flex items-center justify-center ${isAbsent ? 'bg-red-900/50 text-red-500 cursor-not-allowed' : isSelected ? 'bg-blue-600 text-white' : day.isWeekend ? 'bg-nexus-700 text-red-300' : 'bg-nexus-700 text-white hover:bg-nexus-600'}`}>
                     {day.dayNum}
                   </button>
                 );
               })}
             </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><CalendarClock size={20}/> Salvar Escala</button>
        </form>
      </div>
      <div className="xl:col-span-2 bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
         <div className="p-4 border-b border-nexus-700"><h3 className="font-bold text-white">Alocações Recentes</h3></div>
         <div className="overflow-x-auto max-h-[600px]">
           <table className="w-full text-sm text-left text-nexus-300">
             <thead className="bg-nexus-900 text-nexus-400 uppercase text-xs"><tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Colaborador</th><th className="px-6 py-3">Obra</th><th className="px-6 py-3 text-right">Ação</th></tr></thead>
             <tbody className="divide-y divide-nexus-700">
               {schedules.slice().sort((a,b) => b.date.localeCompare(a.date)).map(s => (
                 <tr key={s.id} className="hover:bg-nexus-700/50">
                   <td className="px-6 py-3">{s.date}</td>
                   <td className="px-6 py-3">{employees.find(e => e.id === s.employeeId)?.name}</td>
                   <td className="px-6 py-3">{projects.find(p => p.id === s.projectId)?.name}</td>
                   <td className="px-6 py-3 text-right"><button onClick={() => setSchedules((prev: Schedule[]) => prev.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};

// 3. ABSENCE VIEW
const AbsenceView: React.FC<{ employees: Employee[], absences: Absence[], setAbsences: any }> = ({ employees, absences, setAbsences }) => {
  const [empId, setEmpId] = useState('');
  const [type, setType] = useState<AbsenceType>('Férias');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !start || !end) return alert("Campos obrigatórios.");
    setAbsences((prev: Absence[]) => [...prev, { id: Date.now().toString(), employeeId: empId, type, startDate: start, endDate: end }]);
    setEmpId(''); setStart(''); setEnd('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 h-fit">
        <h3 className="font-bold text-lg text-white mb-4">Registrar Ausência</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="text-xs text-nexus-400">Colaborador</label><select className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" value={empId} onChange={e => setEmpId(e.target.value)}><option value="">Selecione...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div><label className="text-xs text-nexus-400">Tipo</label><select className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" value={type} onChange={e => setType(e.target.value as any)}>{['Férias', 'Atestado Médico', 'Falta', 'Treinamento'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-nexus-400">Início</label><input type="date" className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" value={start} onChange={e => setStart(e.target.value)}/></div>
            <div><label className="text-xs text-nexus-400">Fim</label><input type="date" className="w-full bg-nexus-900 border border-nexus-600 rounded-lg p-2 text-white" value={end} onChange={e => setEnd(e.target.value)}/></div>
          </div>
          <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg">Salvar</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden">
        <div className="p-4 border-b border-nexus-700"><h3 className="font-bold text-white">Histórico</h3></div>
        <table className="w-full text-sm text-left text-nexus-300">
           <thead className="bg-nexus-900 text-nexus-400 uppercase text-xs"><tr><th className="px-6 py-3">Colaborador</th><th className="px-6 py-3">Tipo</th><th className="px-6 py-3">Período</th><th className="px-6 py-3 text-right">Ação</th></tr></thead>
           <tbody className="divide-y divide-nexus-700">
             {absences.map(a => (
               <tr key={a.id} className="hover:bg-nexus-700/50">
                 <td className="px-6 py-3">{employees.find(e => e.id === a.employeeId)?.name}</td>
                 <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-xs border ${a.type === 'Férias' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>{a.type}</span></td>
                 <td className="px-6 py-3">{new Date(a.startDate).toLocaleDateString()} - {new Date(a.endDate).toLocaleDateString()}</td>
                 <td className="px-6 py-3 text-right"><button onClick={() => setAbsences((prev: Absence[]) => prev.filter(x => x.id !== a.id))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button></td>
               </tr>
             ))}
           </tbody>
        </table>
      </div>
    </div>
  );
};

// 4. PROJECTS VIEW
const ProjectsView: React.FC<{ projects: ManagerProject[], setProjects: any }> = ({ projects, setProjects }) => {
  const [isForm, setIsForm] = useState(false);
  const [form, setForm] = useState<any>({ name: '', bu: BU.BUINFRA, hoursSold: 0 });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProjects((prev: ManagerProject[]) => [...prev, { id: Date.now().toString(), ...form, color: BUColorsClass[form.bu] }]);
    setIsForm(false);
  };

  return (
    <div className="animate-fadeIn">
      {!isForm ? (
        <div className="space-y-6">
          <div className="flex justify-between"><h3 className="text-xl font-bold text-white">Projetos Ativos</h3><button onClick={() => setIsForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2"><Plus size={20}/> Novo</button></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map(p => (
              <div key={p.id} className="bg-nexus-800 rounded-xl border border-nexus-700 overflow-hidden group hover:border-nexus-500">
                <div className={`h-2 ${p.color} w-full`}></div>
                <div className="p-6">
                   <div className="flex justify-between mb-4">
                      <span className={`text-xs px-2 py-1 rounded font-bold text-white ${p.color}`}>{p.bu}</span>
                   </div>
                   <h3 className="font-bold text-white text-lg mb-2">{p.name}</h3>
                   <div className="space-y-2 text-sm text-nexus-400">
                      <div className="flex gap-2"><Building2 size={16}/> {p.client}</div>
                      <div className="flex gap-2"><FileText size={16}/> {p.osNumber}</div>
                      <div className="flex gap-2"><MapPin size={16}/> {p.location}</div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto bg-nexus-800 p-8 rounded-xl border border-nexus-700">
          <h3 className="text-xl font-bold text-white mb-6">Novo Projeto</h3>
          <form onSubmit={handleSave} className="space-y-4">
             <div><label className="text-nexus-400 text-xs">Nome</label><input required className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></div>
             <div><label className="text-nexus-400 text-xs">Cliente</label><input required className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" value={form.client} onChange={e => setForm({...form, client: e.target.value})}/></div>
             <div className="grid grid-cols-2 gap-4">
               <div><label className="text-nexus-400 text-xs">BU</label><select className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" value={form.bu} onChange={e => setForm({...form, bu: e.target.value})}>{Object.values(BU).map(b => <option key={b} value={b}>{b}</option>)}</select></div>
               <div><label className="text-nexus-400 text-xs">Horas</label><input type="number" className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" value={form.hoursSold} onChange={e => setForm({...form, hoursSold: Number(e.target.value)})}/></div>
             </div>
             <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsForm(false)} className="px-4 py-2 text-nexus-400 hover:text-white">Cancelar</button>
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg">Salvar</button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
};

// 5. EMPLOYEES VIEW
const EmployeesView: React.FC<{ employees: Employee[], setEmployees: any }> = ({ employees, setEmployees }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  return (
    <div className="space-y-6 animate-fadeIn">
       <div className="bg-nexus-800 p-6 rounded-xl border border-nexus-700 flex gap-4 items-end">
          <div className="flex-1"><label className="text-xs text-nexus-400">Nome</label><input className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" value={name} onChange={e => setName(e.target.value)}/></div>
          <div className="flex-1"><label className="text-xs text-nexus-400">Cargo</label><input className="w-full bg-nexus-900 border border-nexus-600 rounded p-2 text-white" value={role} onChange={e => setRole(e.target.value)}/></div>
          <button onClick={() => { if(name && role) { setEmployees((prev: Employee[]) => [...prev, {id: Date.now().toString(), name, role}]); setName(''); setRole(''); }}} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2"><Plus size={20}/> Add</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(e => (
             <div key={e.id} className="bg-nexus-800 p-4 rounded-xl border border-nexus-700 flex items-center gap-4">
                <div className="w-10 h-10 bg-nexus-900 rounded-full flex items-center justify-center text-nexus-500"><User size={20}/></div>
                <div className="flex-1">
                   <h4 className="text-white font-bold">{e.name}</h4>
                   <p className="text-xs text-nexus-400">{e.role}</p>
                </div>
                <button onClick={() => setEmployees((prev: Employee[]) => prev.filter(x => x.id !== e.id))} className="text-nexus-600 hover:text-red-400"><Trash2 size={16}/></button>
             </div>
          ))}
       </div>
    </div>
  );
};

// 6. REPORTS VIEW
const ReportsView: React.FC<{ schedules: Schedule[], employees: Employee[], projects: ManagerProject[] }> = ({ schedules, employees, projects }) => {
  const handlePrint = () => window.print();
  return (
    <div className="space-y-6 animate-fadeIn">
        <style>{`@media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; } .no-print { display: none; } }`}</style>
        <div className="flex justify-between items-center bg-nexus-800 p-4 rounded-xl border border-nexus-700 no-print">
            <h3 className="text-xl font-bold text-white">Relatório de Escala</h3>
            <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2"><Printer size={20}/> Imprimir PDF</button>
        </div>
        <div id="print-area" className="bg-white text-black p-8 rounded-xl overflow-hidden">
            <div className="mb-6 border-b pb-4">
               <h1 className="text-2xl font-bold uppercase">Teleinfo <span className="text-blue-600">Manager</span></h1>
               <p className="text-sm text-gray-500">Relatório Operacional - Gerado em {new Date().toLocaleDateString()}</p>
            </div>
            <table className="w-full text-xs text-left border-collapse">
               <thead>
                  <tr className="bg-gray-100 uppercase border-b border-gray-300">
                    <th className="p-2 border">Data</th>
                    <th className="p-2 border">Colaborador</th>
                    <th className="p-2 border">Obra</th>
                    <th className="p-2 border">Veículo</th>
                    <th className="p-2 border">Horário</th>
                  </tr>
               </thead>
               <tbody>
                  {schedules.sort((a,b) => a.date.localeCompare(b.date)).map(s => (
                    <tr key={s.id} className="border-b border-gray-200">
                       <td className="p-2 border">{new Date(s.date).toLocaleDateString()}</td>
                       <td className="p-2 border font-bold">{employees.find(e => e.id === s.employeeId)?.name}</td>
                       <td className="p-2 border">{projects.find(p => p.id === s.projectId)?.name}</td>
                       <td className="p-2 border">{s.vehicle}</td>
                       <td className="p-2 border">{s.startTime} - {s.endTime}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
        </div>
    </div>
  );
};

// --- MAIN MODULE ---

export const TeleinfoManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState<ManagerProject[]>(INITIAL_PROJECTS);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [schedules, setSchedules] = useState<Schedule[]>(INITIAL_SCHEDULES);
  const [absences, setAbsences] = useState<Absence[]>(INITIAL_ABSENCES);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Escala', icon: CalendarClock },
    { id: 'absences', label: 'Ausências', icon: UserX },
    { id: 'projects', label: 'Projetos', icon: FolderKanban },
    { id: 'employees', label: 'Equipe', icon: Users },
    { id: 'reports', label: 'Relatórios', icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Teleinfo Manager</h2>
          <p className="text-nexus-400">Gestão Operacional, Escalas e RH Técnico</p>
        </div>
        <div className="flex bg-nexus-800 p-1 rounded-lg border border-nexus-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-400 hover:text-white hover:bg-nexus-700'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
         {activeTab === 'dashboard' && <DashboardView projects={projects} employees={employees} schedules={schedules} />}
         {activeTab === 'schedule' && <ScheduleView projects={projects} employees={employees} schedules={schedules} setSchedules={setSchedules} absences={absences} />}
         {activeTab === 'absences' && <AbsenceView employees={employees} absences={absences} setAbsences={setAbsences} />}
         {activeTab === 'projects' && <ProjectsView projects={projects} setProjects={setProjects} />}
         {activeTab === 'employees' && <EmployeesView employees={employees} setEmployees={setEmployees} />}
         {activeTab === 'reports' && <ReportsView schedules={schedules} employees={employees} projects={projects} />}
      </div>
    </div>
  );
};
