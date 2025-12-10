
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
  password?: string; // Added for local auth simulation
  email?: string;
}

export enum AppModule {
  DASHBOARD = 'dashboard',
  TELEINFO_REPORT = 'teleinfo_report',
  STOCK_MONITOR = 'stock_monitor',
  TELEINFO_MANAGER = 'teleinfo_manager',
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
    date: string; // ISO YYYY-MM-DD
    meta: number;
    realized: number;
}

export interface DetailedProject {
    id: string;
    name: string;
    start: string;
    end: string;
    costCenter?: string;
    steps: DetailedProjectStep[];
    soldHours: BuHours;
    usedHours: BuHours;
    productionData?: ProductionData[]; // New Field
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
    deliveryDate: string; // ISO string or original string
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
  [BU.BUINFRA]: '#f97316', // Orange
  [BU.BUSSE]: '#22c55e',   // Green
  [BU.BUTI]: '#3b82f6',    // Blue
  [BU.BUAUT]: '#a855f7',   // Purple
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
  color: string; // Tailwind class
}

export interface Employee {
  id: string;
  name: string;
  role: string;
}

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  projectId: string;
  employeeId: string;
  vehicle: string;
  osNumber?: string;
  startTime: string;
  endTime: string;
}

export type AbsenceType = 'Férias' | 'Atestado Médico' | 'Treinamento' | 'Troca de Turno' | 'Integração' | 'Falta' | 'Abonar';

export interface Absence {
  id: string;
  employeeId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  reason?: string;
}
