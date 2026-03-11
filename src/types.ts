
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
  password?: string;
  email?: string;
}

export enum AppModule {
  DASHBOARD = 'dashboard',
  TELEINFO_REPORT = 'teleinfo_report',
  STOCK_MONITOR = 'stock_monitor',
  TELEINFO_MANAGER = 'teleinfo_manager',
  OPERATIONAL_SCALE = 'operational_scale',
  USER_MANAGEMENT = 'user_management',
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minLevel: number;
  price: number;
}

export interface ProjectBuyingStatus {
  id: string;
  projeto: string;
  numeroProjeto: string;
  status: 'Padrão' | 'Intermediário' | 'Crítico';
  aComprar: string;
  comprados: string;
  entregue: string;
  dataDisponivel: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  module: string;
}

// --- Project Management Types (Report Module) ---

export interface Project {
  'CLIENTE': string;
  'TIPO DE PROJETO': string;
  'TIPO DE PRODUTO': string;
  'BUs': string;
  'C.Custo': string;
  'STATUS': string;
  perc: number | null;
}

export interface DetailedProjectStep {
    name: string;
    perc: number;
}

export interface BuHours {
    infra: number;
    sse: number;
    ti: number;
    aut: number;
}

export interface ProductionData {
    date: string;
    meta: number;
    realized: number;
}

export interface DetailedProject {
    id: string;
    name: string;
    start: string;
    end: string;
    costCenter?: string;
    bu?: string;
    steps: DetailedProjectStep[];
    soldHours: BuHours;
    usedHours: BuHours;
    productionData?: ProductionData[];
    observations?: string;
}

export interface KeyFact {
    id: string;
    text: string;
    logoUrl?: string;
}

export interface NextStep {
    id: string;
    project: string;
    description: string;
}

export interface FutureDelivery {
    id: string;
    title: string;
    phase: string;
    client: string;
    projectNumber: string;
    deliveryDate: string;
}

// --- Stock & SLA Module Types ---

export enum SLAStatus {
  OK = 'OK',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export interface SLAProject {
  id: string;
  titulo: string;
  numeroProjeto: string;
  inicioFase: string;
  diasNaFase: number;
  entregaTeleinfo?: string;
}

export interface MultiPhaseProject {
  id: string;
  titulo: string;
  numeroProjeto: string;
  diasTriagem: number;
  diasKickoff: number;
  diasEstoque: number;
}

// --- Teleinfo Manager Types ---

export enum BU {
  BUINFRA = 'BU Infraestrutura',
  BUSSE = 'BU Segurança',
  BUTI = 'BU TI',
  BUAUT = 'BU Automação',
}

export const BUColorsHex: Record<string, string> = {
  [BU.BUINFRA]: '#f97316',
  [BU.BUSSE]: '#22c55e',
  [BU.BUTI]: '#3b82f6',
  [BU.BUAUT]: '#a855f7',
};

export const BUColorsClass: Record<string, string> = {
  [BU.BUINFRA]: 'bg-orange-500', 
  [BU.BUSSE]: 'bg-green-500',   
  [BU.BUTI]: 'bg-blue-500',    
  [BU.BUAUT]: 'bg-purple-500',   
};

export interface ManagerProject {
  id: string;
  name: string;
  costCenter: string;
  osNumber: string;
  client: string;
  location: string;
  bu: BU;
  hoursSold: number;
  employeesSold: number;
  address: string;
  color: string;
}

export interface Employee {
  id: string;
  name: string;
  shortName: string;
  role: string;
  active: boolean;
  phone: string;
  internalDoc: string;
  team: string; // BU
  observations: string;
  canDrive: boolean;
  canActAlone: boolean;
  restrictions: string;
  rg?: string; // Visible only to admin
  cpf?: string; // Visible only to admin
}

export interface WorkContract {
  id: string;
  name: string;
  client: string;
  costCenter: string;
  address: string;
  unit: string; // Unit/Block/Regional
  type: string; // implantação, manutenção, etc.
  status: 'Ativa' | 'Concluída' | 'Pausada';
  standardTime: string;
  standardLocation: 'No Cliente' | 'Teleinfo' | 'Outro';
  requiredTeamSize?: number;
  observations: string;
}

export interface FleetVehicle {
  id: string;
  brand: string;
  model: string;
  color: string;
  plate: string;
  status: 'Disponível' | 'Em Uso' | 'Manutenção';
  observations: string;
}

export interface ToolResource {
  id: string;
  name: string;
  quantity: number;
  location: string; // Contract/Location
  status: 'Disponível' | 'Em Uso' | 'Manutenção';
  observations: string;
}

export type AbsenceType = 'Férias' | 'Atestado' | 'Folga' | 'Treinamento' | 'Afastamento' | 'Indisponível';

export interface Absence {
  id: string;
  employeeId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  observations: string;
}

export interface Schedule {
  id: string;
  date: string;
  projectId: string;
  employeeId: string;
  vehicle: string;
  osNumber?: string;
  startTime: string;
  endTime: string;
}

export interface DailyScale {
  id: string;
  date: string;
  employeeId: string;
  workId: string;
  // Auto-filled from workId but can be overridden
  client: string;
  costCenter: string;
  address: string;
  time: string;
  location: string;
  
  vehicleId?: string;
  toolIds: string[];
  observations: string;
  status: 'Escalado' | 'Férias' | 'Atestado' | 'Folga' | 'Treinamento' | 'Indisponível';
  
  // History tracking
  updatedBy?: string;
  updatedAt?: string;
  history?: string; // JSON string of changes
}
