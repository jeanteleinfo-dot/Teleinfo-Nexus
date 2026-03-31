
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Calendar, Users, Briefcase, Truck, Wrench, Plus, Search, Filter, 
  Copy, Share2, Printer, ChevronLeft, ChevronRight, MoreHorizontal,
  Edit2, Trash2, CheckCircle, XCircle, AlertTriangle, Clock, 
  Info, LayoutGrid, List, Group, Download, MessageSquare,
  TrendingUp, Activity, PieChart as PieChartIcon, BarChart as BarChartIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { 
  AppModule, UserRole, Employee, WorkContract, FleetVehicle, 
  ToolResource, Absence, DailyScale, AbsenceType 
} from '../types';
import { useSupabaseData, supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

// --- CONSTANTS & HELPERS ---

const normalizeName = (name: string) => {
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const fuzzySearch = (text: string, query: string) => {
  if (!query) return true;
  const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalizedText.includes(normalizedQuery);
};

const STATUS_COLORS: Record<string, string> = {
  'Escalado': 'bg-green-500',
  'Férias': 'bg-blue-500',
  'Atestado': 'bg-red-500',
  'Folga': 'bg-gray-500',
  'Treinamento': 'bg-yellow-500',
  'Indisponível': 'bg-orange-500',
  'Afastamento': 'bg-red-600',
};

const STATUS_TEXT: Record<string, string> = {
  'Escalado': 'text-green-400',
  'Férias': 'text-blue-400',
  'Atestado': 'text-red-400',
  'Folga': 'text-gray-400',
  'Treinamento': 'text-yellow-400',
  'Indisponível': 'text-orange-400',
  'Afastamento': 'text-red-500',
};

// --- COMPONENTS ---

export const OperationalScale: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'scale' | 'registries' | 'absences' | 'reports'>('scale');
  const [registryTab, setRegistryTab] = useState<'employees' | 'works' | 'fleet' | 'tools'>('employees');

  // Data
  const [employees, setEmployees] = useSupabaseData<Employee[]>('employees', []);
  const [works, setWorks] = useSupabaseData<WorkContract[]>('work_contracts', []);
  const [fleet, setFleet] = useSupabaseData<FleetVehicle[]>('fleet_vehicles', []);
  const [tools, setTools] = useSupabaseData<ToolResource[]>('tool_resources', []);
  const [absences, setAbsences] = useSupabaseData<Absence[]>('absences', []);
  const [scales, setScales] = useSupabaseData<DailyScale[]>('daily_scales', []);

  // Scale View State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'list' | 'cards' | 'grouped_work' | 'grouped_employee'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingScale, setIsEditingScale] = useState(false);
  const [editingScale, setEditingScale] = useState<Partial<DailyScale> | null>(null);

  // Registry Edit State
  const [isEditingRegistry, setIsEditingRegistry] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [isMassScaling, setIsMassScaling] = useState(false);
  const [massScaleData, setMassScaleData] = useState<{ workId: string; employeeIds: string[]; date: string; time: string; vehicleId: string; observations: string }>({
    workId: '',
    employeeIds: [],
    date: selectedDate,
    time: '',
    vehicleId: '',
    observations: ''
  });

  // Intelligent Suggestions
  const frequentCollaborators = useMemo(() => {
    if (!editingScale?.workId) return [];
    const workScales = scales.filter(s => s.workId === editingScale.workId);
    const counts = workScales.reduce((acc, s) => {
      acc[s.employeeId] = (acc[s.employeeId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => employees.find(e => e.id === id))
      .filter(Boolean) as Employee[];
  }, [editingScale?.workId, scales, employees]);

  const unassignedEmployees = useMemo(() => {
    const dayScales = scales.filter(s => s.date === selectedDate);
    const assignedIds = new Set(dayScales.map(s => s.employeeId));
    const absentIds = new Set(absences.filter(a => selectedDate >= a.startDate && selectedDate <= a.endDate).map(a => a.employeeId));
    
    return employees.filter(e => e.active && !assignedIds.has(e.id) && !absentIds.has(e.id));
  }, [selectedDate, scales, employees, absences]);

  const worksWithInsufficientTeam = useMemo(() => {
    const dayScales = scales.filter(s => s.date === selectedDate);
    const workCounts = dayScales.reduce((acc, s) => {
      acc[s.workId] = (acc[s.workId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return works.filter(w => {
      if (w.status !== 'Ativa' || !w.requiredTeamSize) return false;
      const count = workCounts[w.id] || 0;
      return count < w.requiredTeamSize;
    });
  }, [selectedDate, scales, works]);

  const handleSaveMassScale = async () => {
    if (!massScaleData.workId || massScaleData.employeeIds.length === 0 || !massScaleData.date) {
      alert("Preencha os campos obrigatórios: Obra, Colaboradores e Data.");
      return;
    }

    const work = works.find(w => w.id === massScaleData.workId);
    const newScales: DailyScale[] = massScaleData.employeeIds.map(empId => ({
      id: `scale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: massScaleData.date,
      employeeId: empId,
      workId: massScaleData.workId,
      client: work?.client || '',
      costCenter: work?.costCenter || '',
      address: work?.address || '',
      time: massScaleData.time || work?.standardTime || '',
      location: work?.standardLocation || 'No Cliente',
      vehicleId: massScaleData.vehicleId,
      toolIds: [],
      observations: massScaleData.observations,
      status: 'Escalado',
      updatedBy: user?.name,
      updatedAt: new Date().toISOString(),
    }));

    const success = await setScales(prev => [...prev, ...newScales]);
    if (success) {
      setIsMassScaling(false);
      setMassScaleData({ workId: '', employeeIds: [], date: selectedDate, time: '', vehicleId: '', observations: '' });
      alert(`${newScales.length} colaboradores escalados com sucesso!`);
    } else {
      alert("Erro ao salvar escala em massa no banco de dados.");
    }
  };

  // --- HANDLERS ---

  const handleSaveScale = async () => {
    if (!editingScale?.employeeId || !editingScale?.workId || !editingScale?.date) {
      alert("Preencha os campos obrigatórios: Colaborador, Obra e Data.");
      return;
    }

    // Conflict Validations
    const hasConflict = scales.some(s => 
      s.id !== editingScale.id && 
      s.date === editingScale.date && 
      s.employeeId === editingScale.employeeId
    );

    if (hasConflict) {
      if (!confirm("Este colaborador já está escalado para este dia. Deseja continuar?")) return;
    }

    // Absence Validation
    const isAbsent = absences.some(a => 
      a.employeeId === editingScale.employeeId && 
      editingScale.date! >= a.startDate && 
      editingScale.date! <= a.endDate
    );

    if (isAbsent) {
      if (!confirm("Este colaborador possui um registro de ausência para esta data. Deseja continuar?")) return;
    }

    const newScale = {
      ...editingScale,
      id: editingScale.id || `scale-${Date.now()}`,
      updatedBy: user?.name,
      updatedAt: new Date().toISOString(),
    } as DailyScale;

    const success = await setScales(prev => {
      const index = prev.findIndex(s => s.id === newScale.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = newScale;
        return updated;
      }
      return [...prev, newScale];
    });

    if (success) {
      setIsEditingScale(false);
      setEditingScale(null);
    } else {
      alert("Erro ao salvar escala no banco de dados.");
    }
  };

  const handleCopyScale = async (fromDate: string) => {
    const scalesToCopy = scales.filter(s => s.date === fromDate);
    if (scalesToCopy.length === 0) {
      alert("Nenhuma escala encontrada para a data selecionada.");
      return;
    }

    const newScales = scalesToCopy.map(s => ({
      ...s,
      id: `scale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: selectedDate,
      updatedBy: user?.name,
      updatedAt: new Date().toISOString(),
    }));

    const success = await setScales(prev => [...prev, ...newScales]);
    if (success) {
      alert(`${newScales.length} escalas copiadas para ${selectedDate}.`);
    } else {
      alert("Erro ao copiar escalas para o banco de dados.");
    }
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for non-secure contexts or if navigator.clipboard is unavailable
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (err) {
      console.error('Falha ao copiar:', err);
      return false;
    }
  };

  const generateWhatsAppMessage = (date: string) => {
    const dayScales = scales.filter(s => s.date === date);
    if (dayScales.length === 0) return "";

    let message = `*ESCALA DO DIA ${formatDateBR(date)}*\n\n`;

    // Group by work
    const grouped = dayScales.reduce((acc, s) => {
      if (!acc[s.workId]) acc[s.workId] = [];
      acc[s.workId].push(s);
      return acc;
    }, {} as Record<string, DailyScale[]>);

    Object.entries(grouped).forEach(([workId, workScales]) => {
      const work = works.find(w => w.id === workId);
      const first = workScales[0];
      
      message += `*OBRA: ${work?.name || 'N/A'}*\n`;
      message += `Cliente: ${first.client}\n`;
      message += `Centro de custo: ${first.costCenter}\n`;
      message += `Endereço: ${first.address}\n`;
      message += `Horário: ${first.time}\n`;
      
      const names = workScales.map(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        return emp?.name || 'N/A';
      }).join(', ');
      
      message += `Equipe: ${names}\n`;
      
      if (first.vehicleId) {
        const v = fleet.find(f => f.id === first.vehicleId);
        message += `Veículo: ${v ? `${v.plate} (${v.model})` : 'N/A'}\n`;
      }
      
      if (first.observations) {
        message += `Observações: ${first.observations}\n`;
      }
      
      message += `\n-------------------\n\n`;
    });

    return message;
  };

  const handleExportWhatsApp = async () => {
    const message = generateWhatsAppMessage(selectedDate);
    if (!message) {
      alert("Nenhuma escala para exportar.");
      return;
    }
    
    const success = await copyToClipboard(message);
    if (success) {
      alert("Escala formatada copiada para a área de transferência!");
      
      // Optional: Open WhatsApp
      if (confirm("Deseja abrir o WhatsApp agora?")) {
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      }
    } else {
      alert("Não foi possível copiar para a área de transferência. Verifique as permissões do navegador.");
    }
  };

  const handleExportWhatsAppSummary = async () => {
    const dayScales = scales.filter(s => s.date === selectedDate);
    if (dayScales.length === 0) {
      alert("Nenhuma escala para exportar.");
      return;
    }

    let message = `*RESUMO ESCALA ${formatDateBR(selectedDate)}*\n\n`;
    dayScales.forEach(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      const work = works.find(w => w.id === s.workId);
      message += `• ${emp?.name || 'N/A'}: ${work?.name || 'N/A'} - ${s.time}\n`;
    });

    const success = await copyToClipboard(message);
    if (success) {
      alert("Resumo copiado para a área de transferência!");
      
      if (confirm("Deseja abrir o WhatsApp agora?")) {
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      }
    } else {
      alert("Não foi possível copiar para a área de transferência.");
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\ufeff/, "").toUpperCase(),
      complete: async (results) => {
        const importedData = results.data as any[];
        if (importedData.length === 0) {
          alert("O arquivo CSV está vazio ou é inválido.");
          return;
        }

        const processedData = importedData
          .filter(item => Object.values(item).some(val => val !== null && val !== undefined && val !== '')) // Filtra linhas vazias
          .map((item, idx) => {
            const mappedItem: any = {};
            
            if (registryTab === 'employees') {
              // Mapping from user's specific CSV structure
              mappedItem.name = item['NOME COMPLETO'] || item.NAME || "";
              mappedItem.shortName = item['NOME CURTO'] || item.SHORTNAME || mappedItem.name;
              mappedItem.role = item['CARGO / FUNÇÃO'] || item.ROLE || "";
              mappedItem.team = item['EQUIPE / BU'] || item.TEAM || "";
              mappedItem.active = true;
              mappedItem.canDrive = false;
              mappedItem.canActAlone = false;
            } else if (registryTab === 'works') {
              mappedItem.name = item['NOME DE OBRA'] || item.NAME || "";
              mappedItem.client = item['CLIENTE'] || item.CLIENT || "";
              mappedItem.costCenter = item['CENTRO DE CUSTO'] || item.COSTCENTER || "";
              mappedItem.address = item['ENDEREÇO COMPLETO'] || item.ADDRESS || "";
              mappedItem.standardTime = item['HORÁRIO PADRÃO'] || item.STANDARDTIME || "";
              mappedItem.requiredTeamSize = parseInt(item['EQUIPE MÍNIMA'] || item['REQUIREDTEAMSIZE'] || '0') || 0;
              mappedItem.status = 'Ativa';
              mappedItem.unit = item['UNIDADE'] || '';
              mappedItem.type = item['TIPO'] || '';
              mappedItem.observations = item['OBSERVAÇÕES'] || '';
              mappedItem.standardLocation = item['LOCAL PADRÃO'] || 'No Cliente';
            } else if (registryTab === 'fleet') {
              mappedItem.model = item['MARCA / MODELO'] || item.MODEL || "";
              mappedItem.plate = item['PLACA'] || item.PLATE || "";
              const rawStatus = item['SITUAÇÃO'] || item.STATUS || 'Disponível';
              mappedItem.status = rawStatus.includes('Disponivel') ? 'Disponível' : rawStatus;
            }

            const randomSuffix = Math.random().toString(36).substring(2, 7);
            const id = item.id || mappedItem.id || `import-${Date.now()}-${idx}-${randomSuffix}`;
            
            if (registryTab === 'employees') {
              return {
                id,
                name: mappedItem.name,
                shortName: mappedItem.shortName,
                role: mappedItem.role,
                team: mappedItem.team,
                active: item.ACTIVE === undefined ? true : (item.ACTIVE === 'true' || item.ACTIVE === '1' || item.ACTIVE === true),
                canDrive: item.CANDRIVE === 'true' || item.CANDRIVE === '1' || item.CANDRIVE === true,
                canActAlone: item.CANACTALONE === 'true' || item.CANACTALONE === '1' || item.CANACTALONE === true,
              };
            }
            if (registryTab === 'works') {
              return {
                id,
                name: mappedItem.name,
                client: mappedItem.client,
                costCenter: mappedItem.costCenter,
                address: mappedItem.address,
                standardTime: mappedItem.standardTime,
                requiredTeamSize: item.REQUIREDTEAMSIZE ? Number(item.REQUIREDTEAMSIZE) : (mappedItem.requiredTeamSize || 0),
                status: mappedItem.status || 'Ativa',
                unit: mappedItem.unit || '',
                type: mappedItem.type || '',
                observations: mappedItem.observations || '',
                standardLocation: mappedItem.standardLocation || 'No Cliente',
              };
            }
            if (registryTab === 'fleet') {
              return {
                id,
                model: mappedItem.model,
                plate: mappedItem.plate,
                status: mappedItem.status || 'Disponível',
              };
            }
            if (registryTab === 'tools') {
              return {
                id,
                name: item.NAME || item.name || "",
                type: item.TIPO || item.type || "",
                status: item.SITUAÇÃO || item.status || "Disponível",
                quantity: item.QUANTITY ? Number(item.QUANTITY) : (item.quantity ? Number(item.quantity) : 0),
              };
            }
            return { id, ...mappedItem };
          });

        let success = false;
        switch (registryTab) {
          case 'employees':
            success = await setEmployees(prev => [...prev, ...processedData]);
            break;
          case 'works':
            success = await setWorks(prev => [...prev, ...processedData]);
            break;
          case 'fleet':
            success = await setFleet(prev => [...prev, ...processedData]);
            break;
          case 'tools':
            success = await setTools(prev => [...prev, ...processedData]);
            break;
        }
        
        if (success) {
          alert(`${processedData.length} registros importados e salvos com sucesso!`);
        } else {
          alert(`Erro ao salvar os dados no banco de dados. Verifique o console para mais detalhes.`);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        console.error("Erro ao processar CSV:", error);
        alert("Erro ao processar o arquivo CSV.");
      }
    });
  };

  const handleDeleteRegistry = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    
    let success = false;
    switch (registryTab) {
      case 'employees':
        success = await setEmployees(prev => prev.filter(i => i.id !== id));
        break;
      case 'works':
        success = await setWorks(prev => prev.filter(i => i.id !== id));
        break;
      case 'fleet':
        success = await setFleet(prev => prev.filter(i => i.id !== id));
        break;
      case 'tools':
        success = await setTools(prev => prev.filter(i => i.id !== id));
        break;
    }

    if (!success) {
      alert("Erro ao excluir registro do banco de dados.");
    }
  };

  const handleDeleteScale = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta escala?")) return;
    const success = await setScales(prev => prev.filter(s => s.id !== id));
    if (!success) {
      alert("Erro ao excluir escala do banco de dados.");
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro de ausência?")) return;
    const success = await setAbsences(prev => prev.filter(a => a.id !== id));
    if (!success) {
      alert("Erro ao excluir registro de ausência do banco de dados.");
    }
  };

  // --- RENDERERS ---

  const renderRegistryTab = () => {
    let data: any[] = [];
    let columns: { key: string; label: string }[] = [];

    switch (registryTab) {
      case 'employees':
        data = employees;
        columns = [
          { key: 'name', label: 'Nome Completo' },
          { key: 'role', label: 'Cargo' },
          { key: 'team', label: 'Equipe/BU' },
          { key: 'active', label: 'Status' },
        ];
        break;
      case 'works':
        data = works;
        columns = [
          { key: 'name', label: 'Obra' },
          { key: 'client', label: 'Cliente' },
          { key: 'costCenter', label: 'C. Custo' },
          { key: 'status', label: 'Status' },
        ];
        break;
      case 'fleet':
        data = fleet;
        columns = [
          { key: 'plate', label: 'Placa' },
          { key: 'model', label: 'Modelo' },
          { key: 'status', label: 'Situação' },
        ];
        break;
      case 'tools':
        data = tools;
        columns = [
          { key: 'name', label: 'Recurso' },
          { key: 'quantity', label: 'Qtd' },
          { key: 'status', label: 'Situação' },
        ];
        break;
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex bg-nexus-900 p-1 rounded-xl border border-nexus-700">
            {[
              { id: 'employees', label: 'Colaboradores', icon: Users },
              { id: 'works', label: 'Obras', icon: Briefcase },
              { id: 'fleet', label: 'Frota', icon: Truck },
              { id: 'tools', label: 'Ferramentas', icon: Wrench },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setRegistryTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                  registryTab === t.id ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-500 hover:text-white'
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleCSVImport} 
              accept=".csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-nexus-800 hover:bg-nexus-700 text-nexus-300 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold border border-nexus-700"
            >
              <Download size={18} /> Importar CSV
            </button>
            <button 
              onClick={() => {
                setEditingItem({});
                setIsEditingRegistry(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/40"
            >
              <Plus size={18} /> Novo Registro
            </button>
          </div>
        </div>

        <div className="bg-nexus-800 rounded-2xl border border-nexus-700 overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-nexus-900 text-nexus-500 uppercase text-[10px] font-black tracking-widest">
              <tr>
                {columns.map(col => <th key={col.key} className="px-6 py-4">{col.label}</th>)}
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-700">
              {data.map(item => (
                <tr key={item.id} className="hover:bg-nexus-700/30 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4 text-white font-medium">
                      {typeof item[col.key] === 'boolean' ? (
                        item[col.key] ? <span className="text-green-500">Ativo</span> : <span className="text-red-500">Inativo</span>
                      ) : item[col.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingItem(item);
                          setIsEditingRegistry(true);
                        }}
                        className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRegistry(item.id)}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderScaleView = () => {
    const filteredScales = scales.filter(s => {
      if (s.date !== selectedDate) return false;
      if (searchQuery) {
        const emp = employees.find(e => e.id === s.employeeId);
        const work = works.find(w => w.id === s.workId);
        return (
          fuzzySearch(emp?.name || '', searchQuery) ||
          fuzzySearch(work?.name || '', searchQuery) ||
          fuzzySearch(s.client || '', searchQuery) ||
          fuzzySearch(s.costCenter || '', searchQuery)
        );
      }
      return true;
    });

    return (
      <div className="space-y-6">
        {/* Alerts Section */}
        {(unassignedEmployees.length > 0 || worksWithInsufficientTeam.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unassignedEmployees.length > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                <div>
                  <h5 className="text-orange-500 font-black text-[10px] uppercase tracking-widest">Colaboradores Disponíveis ({unassignedEmployees.length})</h5>
                  <p className="text-nexus-400 text-xs mt-1">
                    {unassignedEmployees.map(e => e.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
            {worksWithInsufficientTeam.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <div>
                  <h5 className="text-red-500 font-black text-[10px] uppercase tracking-widest">Equipe Insuficiente ({worksWithInsufficientTeam.length})</h5>
                  <p className="text-nexus-400 text-xs mt-1">
                    {worksWithInsufficientTeam.map(w => `${w.name} (Faltam ${w.requiredTeamSize! - (scales.filter(s => s.workId === w.id && s.date === selectedDate).length)} )`).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center no-print">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-nexus-800 p-1 rounded-xl border border-nexus-700">
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 text-nexus-400 hover:text-white"
              >
                <ChevronLeft size={20} />
              </button>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-black text-sm outline-none px-2"
              />
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 text-nexus-400 hover:text-white"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="flex bg-nexus-900 p-1 rounded-xl border border-nexus-700">
              <button onClick={() => setViewMode('cards')} className={`p-2 rounded-lg ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-nexus-500'}`}><LayoutGrid size={18}/></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-nexus-500'}`}><List size={18}/></button>
              <button onClick={() => setViewMode('grouped_work')} className={`p-2 rounded-lg ${viewMode === 'grouped_work' ? 'bg-blue-600 text-white' : 'text-nexus-500'}`}><Group size={18}/></button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-500" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar escala..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-nexus-800 border border-nexus-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <button 
              onClick={handleExportWhatsApp}
              className="p-2.5 bg-green-600/20 text-green-500 border border-green-500/30 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-lg shadow-green-900/20"
              title="Exportar WhatsApp (Completo)"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={handleExportWhatsAppSummary}
              className="p-2.5 bg-nexus-800 text-nexus-400 border border-nexus-700 rounded-xl hover:bg-nexus-700 hover:text-white transition-all shadow-lg"
              title="Exportar WhatsApp (Resumo)"
            >
              <MessageSquare size={20} />
            </button>
            <button 
              onClick={() => window.print()}
              className="p-2.5 bg-nexus-800 text-nexus-400 border border-nexus-700 rounded-xl hover:bg-nexus-700 hover:text-white transition-all shadow-lg"
              title="Imprimir / PDF"
            >
              <Printer size={20} />
            </button>
            <button 
              onClick={() => {
                setMassScaleData({ workId: '', employeeIds: [], date: selectedDate, time: '', vehicleId: '', observations: '' });
                setIsMassScaling(true);
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-black shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
            >
              <Group size={18} /> Escala em Massa
            </button>
            <button 
              onClick={() => {
                setEditingScale({ date: selectedDate, status: 'Escalado', toolIds: [] });
                setIsEditingScale(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-black shadow-lg shadow-blue-900/40 active:scale-95 transition-all"
            >
              <Plus size={18} /> Montar Escala
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-print">
          <button 
            onClick={() => {
              const yesterday = new Date(selectedDate);
              yesterday.setDate(yesterday.getDate() - 1);
              handleCopyScale(yesterday.toISOString().split('T')[0]);
            }}
            className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-nexus-800 border border-nexus-700 rounded-lg text-[10px] font-black uppercase text-nexus-400 hover:text-white hover:border-nexus-600 transition-all"
          >
            <Copy size={12} /> Copiar de Ontem
          </button>
          <button 
            onClick={() => {
              const lastWeek = new Date(selectedDate);
              lastWeek.setDate(lastWeek.getDate() - 7);
              handleCopyScale(lastWeek.toISOString().split('T')[0]);
            }}
            className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-nexus-800 border border-nexus-700 rounded-lg text-[10px] font-black uppercase text-nexus-400 hover:text-white hover:border-nexus-600 transition-all"
          >
            <Copy size={12} /> Copiar Semana Passada
          </button>
        </div>

        {/* Scale Content */}
        {filteredScales.length === 0 ? (
          <div className="bg-nexus-800 border-2 border-dashed border-nexus-700 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-nexus-900 rounded-full flex items-center justify-center text-nexus-600">
              <Calendar size={40} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Nenhuma escala para este dia</h3>
              <p className="text-nexus-500 max-w-xs mt-2">Comece montando a escala manualmente ou copie de uma data anterior.</p>
            </div>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredScales.map(s => {
              const emp = employees.find(e => e.id === s.employeeId);
              const work = works.find(w => w.id === s.workId);
              return (
                <div key={s.id} className="bg-nexus-800 border border-nexus-700 rounded-2xl p-5 shadow-xl hover:border-blue-500/50 transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-nexus-900 rounded-xl flex items-center justify-center font-black text-blue-500 italic border border-nexus-700">
                        {emp?.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-white font-bold leading-none">{emp?.name}</h4>
                        <p className="text-[10px] text-nexus-500 font-black uppercase mt-1">{emp?.role}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${STATUS_COLORS[s.status]} text-white shadow-lg`}>
                      {s.status}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Briefcase size={14} className="text-nexus-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">{work?.name}</p>
                        <p className="text-[10px] text-nexus-500">{s.client}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-nexus-500 shrink-0" />
                      <p className="text-xs text-nexus-300 font-medium">{s.time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-nexus-500 shrink-0" />
                      <p className="text-xs text-nexus-300">
                        {s.vehicleId ? fleet.find(f => f.id === s.vehicleId)?.plate : 'Sem veículo'}
                      </p>
                    </div>
                  </div>

                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingScale(s);
                        setIsEditingScale(true);
                      }}
                      className="p-1.5 bg-nexus-900 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={() => handleDeleteScale(s.id)}
                      className="p-1.5 bg-nexus-900 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-nexus-800 rounded-2xl border border-nexus-700 overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-nexus-900 text-nexus-500 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Colaborador</th>
                  <th className="px-6 py-4">Obra / Cliente</th>
                  <th className="px-6 py-4">Horário</th>
                  <th className="px-6 py-4">Veículo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-700">
                {filteredScales.map(s => {
                  const emp = employees.find(e => e.id === s.employeeId);
                  const work = works.find(w => w.id === s.workId);
                  return (
                        <tr key={s.id} className="hover:bg-nexus-700/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-nexus-900 rounded-lg flex items-center justify-center font-black text-blue-500 text-xs">
                                {emp?.name.charAt(0)}
                              </div>
                              <span className="text-white font-bold">{emp?.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-white font-medium">{work?.name}</p>
                            <p className="text-[10px] text-nexus-500 uppercase font-black">{s.client}</p>
                          </td>
                          <td className="px-6 py-4 text-nexus-300">{s.time}</td>
                          <td className="px-6 py-4 text-nexus-300">
                            {s.vehicleId ? fleet.find(f => f.id === s.vehicleId)?.plate : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${STATUS_COLORS[s.status]} text-white shadow-sm`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setEditingScale(s);
                                  setIsEditingScale(true);
                                }}
                                className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteScale(s.id)}
                                className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              >
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
    );
  };

  const renderReports = () => {
    const stats = {
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.active).length,
      totalWorks: works.filter(w => w.status === 'Ativa').length,
      fleetAvailable: fleet.filter(v => v.status === 'Disponível').length,
      todayScales: scales.filter(s => s.date === selectedDate).length,
    };

    const buDistribution = employees.reduce((acc, e) => {
      acc[e.team] = (acc[e.team] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const buData = Object.entries(buDistribution).map(([name, value]) => ({ name, value }));

    return (
      <div className="space-y-8 animate-fadeIn">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-nexus-800 p-5 rounded-2xl border border-nexus-700 shadow-xl">
            <p className="text-[10px] font-black text-nexus-500 uppercase tracking-widest mb-1">Técnicos Ativos</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-white">{stats.activeEmployees}</h3>
              <Users className="text-blue-500" size={20} />
            </div>
          </div>
          <div className="bg-nexus-800 p-5 rounded-2xl border border-nexus-700 shadow-xl">
            <p className="text-[10px] font-black text-nexus-500 uppercase tracking-widest mb-1">Obras Ativas</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-white">{stats.totalWorks}</h3>
              <Briefcase className="text-purple-500" size={20} />
            </div>
          </div>
          <div className="bg-nexus-800 p-5 rounded-2xl border border-nexus-700 shadow-xl">
            <p className="text-[10px] font-black text-nexus-500 uppercase tracking-widest mb-1">Escalados Hoje</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-green-500">{stats.todayScales}</h3>
              <Activity className="text-green-500" size={20} />
            </div>
          </div>
          <div className="bg-nexus-800 p-5 rounded-2xl border border-nexus-700 shadow-xl">
            <p className="text-[10px] font-black text-nexus-500 uppercase tracking-widest mb-1">Frota Disponível</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-blue-400">{stats.fleetAvailable}</h3>
              <Truck className="text-blue-400" size={20} />
            </div>
          </div>
          <div className="bg-nexus-800 p-5 rounded-2xl border border-nexus-700 shadow-xl">
            <p className="text-[10px] font-black text-nexus-500 uppercase tracking-widest mb-1">Em Férias</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-orange-500">
                {absences.filter(a => a.type === 'Férias' && selectedDate >= a.startDate && selectedDate <= a.endDate).length}
              </h3>
              <Clock className="text-orange-500" size={20} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-nexus-800 p-6 rounded-3xl border border-nexus-700 shadow-2xl">
            <h4 className="text-white font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <PieChartIcon size={16} className="text-blue-500" /> Distribuição por Equipe (BU)
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={buData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {buData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ef4444'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-nexus-800 p-6 rounded-3xl border border-nexus-700 shadow-2xl">
            <h4 className="text-white font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <BarChartIcon size={16} className="text-purple-500" /> Alocação por Obra (Top 5)
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={works.slice(0, 5).map(w => ({ 
                  name: w.name, 
                  count: scales.filter(s => s.workId === w.id && s.date === selectedDate).length 
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <Calendar className="text-blue-500" /> Escala Operacional
          </h2>
          <p className="text-nexus-400 text-sm">Gestão dinâmica de equipes, obras e recursos.</p>
        </div>
        <div className="flex bg-nexus-800 p-1.5 rounded-2xl border border-nexus-700 shadow-xl">
          {[
            { id: 'scale', label: 'Escala Diária', icon: Calendar },
            { id: 'registries', label: 'Cadastros', icon: List },
            { id: 'absences', label: 'Férias/Ausências', icon: Clock },
            { id: 'reports', label: 'Relatórios', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-nexus-500 hover:text-white'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[600px]">
        {activeTab === 'scale' && renderScaleView()}
        {activeTab === 'registries' && renderRegistryTab()}
        {activeTab === 'absences' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white flex items-center gap-2"><Clock className="text-orange-500" /> Gestão de Férias e Ausências</h3>
              <button 
                onClick={() => {
                  setEditingItem({ startDate: selectedDate, endDate: selectedDate, type: 'Férias' });
                  setIsEditingRegistry(true);
                  setRegistryTab('employees'); // We'll use a special flag or just check tab
                }}
                className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-orange-900/40"
              >
                <Plus size={18} /> Lançar Ausência
              </button>
            </div>
            
            <div className="bg-nexus-800 rounded-2xl border border-nexus-700 overflow-hidden shadow-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-nexus-900 text-nexus-500 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Colaborador</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Início</th>
                    <th className="px-6 py-4">Fim</th>
                    <th className="px-6 py-4">Observações</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-700">
                  {absences.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-nexus-500 italic">Nenhuma ausência registrada.</td>
                    </tr>
                  ) : (
                    absences.map(a => {
                      const emp = employees.find(e => e.id === a.employeeId);
                      return (
                        <tr key={a.id} className="hover:bg-nexus-700/30 transition-colors">
                          <td className="px-6 py-4 text-white font-bold">{emp?.name || 'N/A'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${STATUS_COLORS[a.type]} text-white`}>
                              {a.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-nexus-300">{new Date(a.startDate).toLocaleDateString('pt-BR')}</td>
                          <td className="px-6 py-4 text-nexus-300">{new Date(a.endDate).toLocaleDateString('pt-BR')}</td>
                          <td className="px-6 py-4 text-nexus-400 text-xs italic">{a.observations}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteAbsence(a.id)}
                              className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'reports' && renderReports()}
      </div>

      {/* Scale Edit Modal */}
      {isEditingScale && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-nexus-800 border border-nexus-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                <Calendar size={20} /> {editingScale?.id ? 'Editar Escala' : 'Nova Escala'}
              </h3>
              <button onClick={() => setIsEditingScale(false)} className="hover:bg-white/10 p-2 rounded-full transition-all"><XCircle size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Colaborador *</label>
                  <select 
                    value={editingScale?.employeeId || ''} 
                    onChange={e => setEditingScale({ ...editingScale, employeeId: e.target.value })}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  {frequentCollaborators.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[8px] font-black text-nexus-600 uppercase w-full mb-1">Sugestões (Frequentes):</span>
                      {frequentCollaborators.map(fc => (
                        <button 
                          key={fc.id}
                          onClick={() => setEditingScale({ ...editingScale, employeeId: fc.id })}
                          className="px-2 py-1 bg-nexus-900 border border-nexus-700 rounded-md text-[9px] text-nexus-400 hover:text-white hover:border-blue-500 transition-all"
                        >
                          {fc.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Obra *</label>
                  <select 
                    value={editingScale?.workId || ''} 
                    onChange={e => {
                      const work = works.find(w => w.id === e.target.value);
                      setEditingScale({ 
                        ...editingScale, 
                        workId: e.target.value,
                        client: work?.client || '',
                        costCenter: work?.costCenter || '',
                        address: work?.address || '',
                        time: work?.standardTime || '',
                        location: work?.standardLocation || 'No Cliente'
                      });
                    }}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {works.filter(w => w.status === 'Ativa').map(w => <option key={w.id} value={w.id}>{w.name} ({w.costCenter})</option>)}
                  </select>
                  <div className="mt-2">
                    <label className="text-[8px] font-black text-nexus-600 uppercase block mb-1">Busca por Centro de Custo:</label>
                    <input 
                      type="text"
                      placeholder="Digite o CC..."
                      className="w-full bg-nexus-900 border border-nexus-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                      onChange={e => {
                        const cc = e.target.value;
                        if (cc.length >= 3) {
                          const work = works.find(w => w.costCenter.includes(cc));
                          if (work) {
                            setEditingScale({ 
                              ...editingScale, 
                              workId: work.id,
                              client: work.client,
                              costCenter: work.costCenter,
                              address: work.address,
                              time: work.standardTime,
                              location: work.standardLocation
                            });
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Horário</label>
                  <input 
                    type="text" 
                    value={editingScale?.time || ''} 
                    onChange={e => setEditingScale({ ...editingScale, time: e.target.value })}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Veículo</label>
                  <select 
                    value={editingScale?.vehicleId || ''} 
                    onChange={e => setEditingScale({ ...editingScale, vehicleId: e.target.value })}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Nenhum</option>
                    {fleet.filter(v => v.status === 'Disponível').map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Observações</label>
                  <textarea 
                    value={editingScale?.observations || ''} 
                    onChange={e => setEditingScale({ ...editingScale, observations: e.target.value })}
                    rows={3}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-nexus-900 p-6 border-t border-nexus-700 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsEditingScale(false)} className="px-6 py-2 text-nexus-400 font-bold hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSaveScale} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/40 transition-all active:scale-95">
                Salvar Escala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registry Edit Modal */}
      {isEditingRegistry && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-nexus-800 border border-nexus-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                {registryTab === 'employees' ? <Users size={20}/> : registryTab === 'works' ? <Briefcase size={20}/> : registryTab === 'fleet' ? <Truck size={20}/> : <Wrench size={20}/>}
                {editingItem?.id ? 'Editar' : 'Novo'} {registryTab === 'employees' ? 'Colaborador' : registryTab === 'works' ? 'Obra' : registryTab === 'fleet' ? 'Veículo' : 'Ferramenta'}
              </h3>
              <button onClick={() => setIsEditingRegistry(false)} className="hover:bg-white/10 p-2 rounded-full transition-all"><XCircle size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              {activeTab === 'absences' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Colaborador *</label>
                    <select value={editingItem?.employeeId || ''} onChange={e => setEditingItem({...editingItem, employeeId: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
                      <option value="">Selecione...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Tipo de Ausência *</label>
                    <select value={editingItem?.type || 'Férias'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
                      <option value="Férias">Férias</option>
                      <option value="Atestado">Atestado</option>
                      <option value="Folga">Folga</option>
                      <option value="Treinamento">Treinamento</option>
                      <option value="Afastamento">Afastamento</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Data Inicial *</label>
                    <input type="date" value={editingItem?.startDate || ''} onChange={e => setEditingItem({...editingItem, startDate: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Data Final *</label>
                    <input type="date" value={editingItem?.endDate || ''} onChange={e => setEditingItem({...editingItem, endDate: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Observações</label>
                    <textarea value={editingItem?.observations || ''} onChange={e => setEditingItem({...editingItem, observations: e.target.value})} rows={3} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none resize-none" />
                  </div>
                </div>
              ) : registryTab === 'employees' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Nome Completo *</label>
                    <input type="text" value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Nome Curto *</label>
                    <input type="text" value={editingItem?.shortName || ''} onChange={e => setEditingItem({...editingItem, shortName: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Cargo / Função *</label>
                    <input type="text" value={editingItem?.role || ''} onChange={e => setEditingItem({...editingItem, role: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Equipe / BU *</label>
                    <select value={editingItem?.team || ''} onChange={e => setEditingItem({...editingItem, team: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
                      <option value="">Selecione...</option>
                      <option value="BU Infraestrutura">BU Infraestrutura</option>
                      <option value="BU Segurança">BU Segurança</option>
                      <option value="BU TI">BU TI</option>
                      <option value="BU Automação">BU Automação</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Telefone</label>
                    <input type="text" value={editingItem?.phone || ''} onChange={e => setEditingItem({...editingItem, phone: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Documento Interno</label>
                    <input type="text" value={editingItem?.internalDoc || ''} onChange={e => setEditingItem({...editingItem, internalDoc: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  {isAdmin && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">RG (Admin Only)</label>
                        <input type="text" value={editingItem?.rg || ''} onChange={e => setEditingItem({...editingItem, rg: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">CPF (Admin Only)</label>
                        <input type="text" value={editingItem?.cpf || ''} onChange={e => setEditingItem({...editingItem, cpf: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                      </div>
                    </>
                  )}
                  <div className="flex gap-6 col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingItem?.active ?? true} onChange={e => setEditingItem({...editingItem, active: e.target.checked})} className="w-4 h-4 rounded border-nexus-700 bg-nexus-900 text-blue-600" />
                      <span className="text-xs text-white font-bold">Ativo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingItem?.canDrive || false} onChange={e => setEditingItem({...editingItem, canDrive: e.target.checked})} className="w-4 h-4 rounded border-nexus-700 bg-nexus-900 text-blue-600" />
                      <span className="text-xs text-white font-bold">Pode Dirigir</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingItem?.canActAlone || false} onChange={e => setEditingItem({...editingItem, canActAlone: e.target.checked})} className="w-4 h-4 rounded border-nexus-700 bg-nexus-900 text-blue-600" />
                      <span className="text-xs text-white font-bold">Pode Atuar Sozinho</span>
                    </label>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Restrições / Observações</label>
                    <textarea value={editingItem?.observations || ''} onChange={e => setEditingItem({...editingItem, observations: e.target.value})} rows={3} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none resize-none" />
                  </div>
                </div>
              ) : registryTab === 'works' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Nome da Obra *</label>
                    <input type="text" value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Cliente *</label>
                    <input type="text" value={editingItem?.client || ''} onChange={e => setEditingItem({...editingItem, client: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Centro de Custo *</label>
                    <input type="text" value={editingItem?.costCenter || ''} onChange={e => setEditingItem({...editingItem, costCenter: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Endereço Completo</label>
                    <input type="text" value={editingItem?.address || ''} onChange={e => setEditingItem({...editingItem, address: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Horário Padrão</label>
                    <input type="text" value={editingItem?.standardTime || ''} onChange={e => setEditingItem({...editingItem, standardTime: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Equipe Mínima</label>
                    <input type="number" value={editingItem?.requiredTeamSize || ''} onChange={e => setEditingItem({...editingItem, requiredTeamSize: e.target.value ? parseInt(e.target.value) : 0})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Local Padrão</label>
                    <select value={editingItem?.standardLocation || 'No Cliente'} onChange={e => setEditingItem({...editingItem, standardLocation: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
                      <option value="No Cliente">No Cliente</option>
                      <option value="Teleinfo">Teleinfo</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
              ) : registryTab === 'fleet' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Marca / Modelo *</label>
                    <input type="text" value={editingItem?.model || ''} onChange={e => setEditingItem({...editingItem, model: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Placa *</label>
                    <input type="text" value={editingItem?.plate || ''} onChange={e => setEditingItem({...editingItem, plate: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Situação</label>
                    <select value={editingItem?.status || 'Disponível'} onChange={e => setEditingItem({...editingItem, status: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
                      <option value="Disponível">Disponível</option>
                      <option value="Em Uso">Em Uso</option>
                      <option value="Manutenção">Manutenção</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Nome do Recurso *</label>
                    <input type="text" value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Quantidade</label>
                    <input type="number" value={editingItem?.quantity || 0} onChange={e => setEditingItem({...editingItem, quantity: parseInt(e.target.value)})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Situação</label>
                    <select value={editingItem?.status || 'Disponível'} onChange={e => setEditingItem({...editingItem, status: e.target.value})} className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
                      <option value="Disponível">Disponível</option>
                      <option value="Em Uso">Em Uso</option>
                      <option value="Manutenção">Manutenção</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-nexus-900 p-6 border-t border-nexus-700 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsEditingRegistry(false)} className="px-6 py-2 text-nexus-400 font-bold hover:text-white transition-colors">Cancelar</button>
              <button 
                onClick={async () => {
                  if (registryTab === 'works' && !editingItem.name) {
                    alert("O nome da obra é obrigatório.");
                    return;
                  }
                  if (registryTab === 'employees' && !editingItem.name) {
                    alert("O nome do colaborador é obrigatório.");
                    return;
                  }

                  let newItem = { ...editingItem, id: editingItem.id || `${activeTab === 'absences' ? 'absence' : registryTab}-${Date.now()}` };
                  
                  // Normalization
                  if (newItem.name) newItem.name = normalizeName(newItem.name);
                  if (newItem.shortName) newItem.shortName = normalizeName(newItem.shortName);
                  if (newItem.client) newItem.client = normalizeName(newItem.client);

                  // Default values for works
                  if (registryTab === 'works') {
                    newItem = {
                      ...newItem,
                      status: newItem.status || 'Ativa',
                      unit: newItem.unit || '',
                      type: newItem.type || '',
                      observations: newItem.observations || '',
                      client: newItem.client || 'N/A',
                      costCenter: newItem.costCenter || 'N/A',
                      address: newItem.address || 'N/A',
                      standardTime: newItem.standardTime || '08:00 - 18:00',
                      standardLocation: newItem.standardLocation || 'No Cliente',
                      requiredTeamSize: newItem.requiredTeamSize || 0
                    };
                  }

                  let success = false;
                  if (activeTab === 'absences') {
                    success = await setAbsences(prev => {
                      const idx = prev.findIndex(i => i.id === newItem.id);
                      if (idx >= 0) { const u = [...prev]; u[idx] = newItem; return u; }
                      return [...prev, newItem];
                    });
                  } else if (registryTab === 'employees') {
                    success = await setEmployees(prev => {
                      const idx = prev.findIndex(i => i.id === newItem.id);
                      if (idx >= 0) { const u = [...prev]; u[idx] = newItem; return u; }
                      return [...prev, newItem];
                    });
                  } else if (registryTab === 'works') {
                    success = await setWorks(prev => {
                      const idx = prev.findIndex(i => i.id === newItem.id);
                      if (idx >= 0) { const u = [...prev]; u[idx] = newItem; return u; }
                      return [...prev, newItem];
                    });
                  } else if (registryTab === 'fleet') {
                    success = await setFleet(prev => {
                      const idx = prev.findIndex(i => i.id === newItem.id);
                      if (idx >= 0) { const u = [...prev]; u[idx] = newItem; return u; }
                      return [...prev, newItem];
                    });
                  } else if (registryTab === 'tools') {
                    success = await setTools(prev => {
                      const idx = prev.findIndex(i => i.id === newItem.id);
                      if (idx >= 0) { const u = [...prev]; u[idx] = newItem; return u; }
                      return [...prev, newItem];
                    });
                  }
                  
                  if (success) {
                    setIsEditingRegistry(false);
                  } else {
                    alert("Erro ao salvar registro no banco de dados.");
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/40 transition-all active:scale-95"
              >
                Salvar Registro
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mass Scale Modal */}
      {isMassScaling && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-nexus-800 border border-nexus-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-purple-600 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                <Group size={20} /> Escala em Massa
              </h3>
              <button onClick={() => setIsMassScaling(false)} className="hover:bg-white/10 p-2 rounded-full transition-all"><XCircle size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Obra *</label>
                  <select 
                    value={massScaleData.workId} 
                    onChange={e => {
                      const work = works.find(w => w.id === e.target.value);
                      setMassScaleData({ ...massScaleData, workId: e.target.value, time: work?.standardTime || '' });
                    }}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Selecione a Obra...</option>
                    {works.filter(w => w.status === 'Ativa').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Horário</label>
                  <input 
                    type="text" 
                    value={massScaleData.time} 
                    onChange={e => setMassScaleData({ ...massScaleData, time: e.target.value })}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="Ex: 08:00 - 18:00"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Colaboradores * (Selecione vários)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 bg-nexus-900 rounded-xl border border-nexus-700 custom-scrollbar">
                    {employees.filter(e => e.active).map(e => (
                      <label key={e.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${massScaleData.employeeIds.includes(e.id) ? 'bg-blue-600/20 border border-blue-600/40' : 'hover:bg-nexus-800'}`}>
                        <input 
                          type="checkbox" 
                          checked={massScaleData.employeeIds.includes(e.id)}
                          onChange={ev => {
                            if (ev.target.checked) {
                              setMassScaleData({ ...massScaleData, employeeIds: [...massScaleData.employeeIds, e.id] });
                            } else {
                              setMassScaleData({ ...massScaleData, employeeIds: massScaleData.employeeIds.filter(id => id !== e.id) });
                            }
                          }}
                          className="w-4 h-4 rounded border-nexus-700 bg-nexus-900 text-blue-600"
                        />
                        <span className="text-xs text-white truncate">{e.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Veículo</label>
                  <select 
                    value={massScaleData.vehicleId} 
                    onChange={e => setMassScaleData({ ...massScaleData, vehicleId: e.target.value })}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Nenhum</option>
                    {fleet.filter(v => v.status === 'Disponível').map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-nexus-500 uppercase tracking-widest">Observações</label>
                  <textarea 
                    value={massScaleData.observations} 
                    onChange={e => setMassScaleData({ ...massScaleData, observations: e.target.value })}
                    rows={3}
                    className="w-full bg-nexus-900 border border-nexus-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-nexus-900 p-6 border-t border-nexus-700 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsMassScaling(false)} className="px-6 py-2 text-nexus-400 font-bold hover:text-white transition-colors">Cancelar</button>
              <button 
                onClick={handleSaveMassScale}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-purple-900/40 transition-all active:scale-95"
              >
                Lançar Escala em Massa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
