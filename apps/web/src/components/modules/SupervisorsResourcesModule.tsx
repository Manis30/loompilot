import React, { useState, useMemo, useEffect } from 'react';
import {
  HardHat,
  Check,
  Users,
  Activity,
  Layers,
  Wrench,
  AlertTriangle,
  Search,
  Plus,
  History,
  CheckCircle2,
  X,
  MoreHorizontal,
  ArrowUpDown,
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { AppUser, Order } from '../../types';
import { useGetMachinesQuery } from '../../store/api/catalogApi';
import { useCreateMachineMutation, useUpdateMachineStatusMutation } from '../../store/api/machinesApi';
import { useCreateMaintenanceTicketMutation } from '../../store/api/productionApi';
import { mapApiMachineToMachineItem } from '../../client-supervisor/pages/supervisor/machineMapper';

// =========================================================================
// DATA MODELS & TYPES
// =========================================================================

export type MachineStatus = 'Running' | 'Idle' | 'Reserved' | 'Breakdown' | 'Maintenance';
export type WorkerAttendance = 'Present' | 'Absent' | 'On Leave';
export type ShiftType = 'Morning Shift (06:00 - 14:00)' | 'Evening Shift (14:00 - 22:00)' | 'Night Shift (22:00 - 06:00)' | 'General Shift (08:00 - 17:00)';

export interface SupervisorProfile {
  id: string; // e.g. 'usr_sup_1'
  empId: string; // 'EMP-SUP-01'
  name: string;
  designation: string;
  department: string;
  assignedShedId: string;
  assignedShedName: string;
  shift: ShiftType;
  attendanceStatus: 'On Duty' | 'Off Duty' | 'On Leave';
  activeOrdersCount: number;
  maxOrderCapacity: number; // e.g. 5 orders max
  workloadPercent: number;  // (active / max) * 100
  availabilityStatus: 'Available' | 'At Capacity' | 'Unavailable';
  email: string;
  phone: string;
  joinedDate: string;
  // Performance indicators (Section 3C)
  dailyTarget: number;
  dailyActual: number;
  targetAchievementPercent: number;
  rejectionRatePercent: number;
  materialWastagePercent: number;
  delayedOrdersCount: number;
  dailyReportStatus: 'Submitted' | 'Pending Review' | 'Not Submitted';
  reportSubmittedAt: string;
}

export interface FactoryShed {
  id: string; // 'shed_a', 'shed_b', 'shed_c'
  name: string;
  supervisorId: string;
  supervisorName: string;
  totalMachines: number;
  runningMachines: number;
  idleMachines: number;
  maintenanceMachines: number;
  breakdownMachines: number;
  workersScheduled: number;
  workersPresent: number;
  dailyTargetMeters: number;
  dailyActualMeters: number;
  remainingCapacityMeters: number;
  operatingSpeedText: string;
  maintenanceNotes: string;
  overtimeAuthorized: boolean;
}

export interface MachineItem {
  id: string; // 'MCH-AJ-12'
  name: string;
  type: string;
  shedId: string;
  shedName: string;
  status: MachineStatus;
  assignedOrderId?: string;
  assignedStage?: string;
  operatingHours: number;
  operatingSpeed: string; // e.g. '850 RPM'
  lastMaintenanceDate: string;
  nextScheduledMaintenance: string;
  breakdownReason?: string;
  assignedTechnician?: string;
}

export interface WorkerItem {
  id: string;
  empId: string; // 'EMP-WRK-101'
  name: string;
  skill: string;
  department: string;
  shedId: string;
  shedName: string;
  shift: ShiftType;
  attendanceStatus: WorkerAttendance;
  currentAssignment: string;
  availability: 'Active & Assigned' | 'Available / Pool' | 'On Leave';
  overtimeHours: number;
}

export interface OvertimeRequest {
  id: string;
  shedId: string;
  shedName: string;
  requestedBy: string;
  workersCount: number;
  hoursRequested: number;
  shift: string;
  targetOrder: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

export interface ResourceAuditEntry {
  id: string;
  user: string;
  action: string;
  entityType: 'Supervisor' | 'Machine' | 'Worker' | 'Allocation' | 'Overtime';
  entityId: string;
  details: string;
  timestamp: string;
}

// =========================================================================
// INITIAL MOCK MASTER DATA
// =========================================================================

const INITIAL_SUPERVISORS: SupervisorProfile[] = [
  {
    id: 'usr_sup_1',
    empId: 'EMP-SUP-01',
    name: 'Ramesh Kumar',
    designation: 'Head Production Master',
    department: 'Airjet Weaving & Stitching',
    assignedShedId: 'shed_a',
    assignedShedName: 'Shed A - Airjet Weaving & Stitching',
    shift: 'Morning Shift (06:00 - 14:00)',
    attendanceStatus: 'On Duty',
    activeOrdersCount: 4,
    maxOrderCapacity: 5,
    workloadPercent: 80,
    availabilityStatus: 'Available',
    email: 'ramesh@loompilot.com',
    phone: '+91 98421 11001',
    joinedDate: '15 Feb 2026',
    dailyTarget: 2500,
    dailyActual: 2420,
    targetAchievementPercent: 96.8,
    rejectionRatePercent: 1.2,
    materialWastagePercent: 0.8,
    delayedOrdersCount: 1, // LP-902 due to yarn shortage
    dailyReportStatus: 'Submitted',
    reportSubmittedAt: 'Today 09:15 AM'
  },
  {
    id: 'usr_sup_2',
    empId: 'EMP-SUP-02',
    name: 'Murugan K.',
    designation: 'Dyeing & Weaving Master',
    department: 'Continuous Dyeing Bay',
    assignedShedId: 'shed_b',
    assignedShedName: 'Shed B - Dyeing & Finishing',
    shift: 'General Shift (08:00 - 17:00)',
    attendanceStatus: 'On Duty',
    activeOrdersCount: 2,
    maxOrderCapacity: 4,
    workloadPercent: 50,
    availabilityStatus: 'Available',
    email: 'murugan@loompilot.com',
    phone: '+91 98421 11002',
    joinedDate: '20 Feb 2026',
    dailyTarget: 1500,
    dailyActual: 1480,
    targetAchievementPercent: 98.6,
    rejectionRatePercent: 0.9,
    materialWastagePercent: 1.1,
    delayedOrdersCount: 1, // TX-1025 chemical lead time
    dailyReportStatus: 'Submitted',
    reportSubmittedAt: 'Today 08:45 AM'
  },
  {
    id: 'usr_sup_3',
    empId: 'EMP-SUP-03',
    name: 'Arunachalam S.',
    designation: 'Finishing & QA Inspector',
    department: 'Final 4-Point Inspection Bay',
    assignedShedId: 'shed_c',
    assignedShedName: 'Shed C - Warping & QA Bay',
    shift: 'Morning Shift (06:00 - 14:00)',
    attendanceStatus: 'On Duty',
    activeOrdersCount: 1,
    maxOrderCapacity: 4,
    workloadPercent: 25,
    availabilityStatus: 'Available',
    email: 'arun@loompilot.com',
    phone: '+91 98421 11003',
    joinedDate: '01 Mar 2026',
    dailyTarget: 800,
    dailyActual: 790,
    targetAchievementPercent: 98.7,
    rejectionRatePercent: 0.6,
    materialWastagePercent: 0.4,
    delayedOrdersCount: 0,
    dailyReportStatus: 'Submitted',
    reportSubmittedAt: 'Today 10:00 AM'
  }
];

const INITIAL_SHEDS: FactoryShed[] = [
  {
    id: 'shed_a',
    name: 'Airjet Weaving & Stitching Shed A',
    supervisorId: 'usr_sup_1',
    supervisorName: 'Ramesh Kumar',
    totalMachines: 24,
    runningMachines: 19,
    idleMachines: 4,
    maintenanceMachines: 0,
    breakdownMachines: 1, // Loom #7
    workersScheduled: 25,
    workersPresent: 24,
    dailyTargetMeters: 1400,
    dailyActualMeters: 1300,
    remainingCapacityMeters: 100,
    operatingSpeedText: '850 RPM Uptime',
    maintenanceNotes: 'Loom #7 warp tension sensor recalibrated today. Technician assigned.',
    overtimeAuthorized: false
  },
  {
    id: 'shed_b',
    name: 'Dyeing & Finishing Shed B',
    supervisorId: 'usr_sup_2',
    supervisorName: 'Murugan K.',
    totalMachines: 16,
    runningMachines: 12,
    idleMachines: 4,
    maintenanceMachines: 0,
    breakdownMachines: 0,
    workersScheduled: 20,
    workersPresent: 20,
    dailyTargetMeters: 1500,
    dailyActualMeters: 1480,
    remainingCapacityMeters: 20,
    operatingSpeedText: 'Eco Soft-Flow Active',
    maintenanceNotes: 'Eco dye soft-flow temperature sensor calibrated and certified.',
    overtimeAuthorized: false
  },
  {
    id: 'shed_c',
    name: 'Warping & Quality Bay Shed C',
    supervisorId: 'usr_sup_3',
    supervisorName: 'Arunachalam S.',
    totalMachines: 8,
    runningMachines: 4,
    idleMachines: 4,
    maintenanceMachines: 0,
    breakdownMachines: 0,
    workersScheduled: 10,
    workersPresent: 10,
    dailyTargetMeters: 800,
    dailyActualMeters: 780,
    remainingCapacityMeters: 20,
    operatingSpeedText: '650 m/min Warper Uptime',
    maintenanceNotes: 'Direct warper creel tension checked. 100% operational.',
    overtimeAuthorized: false
  }
];

const INITIAL_MACHINES: MachineItem[] = [];

const INITIAL_WORKFORCE: WorkerItem[] = [
  {
    id: 'wrk_1',
    empId: 'EMP-WRK-101',
    name: 'P. Shanmugam',
    skill: 'Airjet Loom Operator',
    department: 'Weaving',
    shedId: 'shed_a',
    shedName: 'Shed A',
    shift: 'Morning Shift (06:00 - 14:00)',
    attendanceStatus: 'Present',
    currentAssignment: 'Order LP-901 / Loom #12',
    availability: 'Active & Assigned',
    overtimeHours: 2
  },
  {
    id: 'wrk_2',
    empId: 'EMP-WRK-102',
    name: 'M. Karthik',
    skill: 'Weaving Beam Sizer',
    department: 'Weaving',
    shedId: 'shed_a',
    shedName: 'Shed A',
    shift: 'Morning Shift (06:00 - 14:00)',
    attendanceStatus: 'Present',
    currentAssignment: 'Order LP-902 / Loom #14',
    availability: 'Active & Assigned',
    overtimeHours: 0
  },
  {
    id: 'wrk_3',
    empId: 'EMP-WRK-103',
    name: 'K. Selvam',
    skill: 'Airjet Loom Operator',
    department: 'Weaving',
    shedId: 'shed_a',
    shedName: 'Shed A',
    shift: 'Morning Shift (06:00 - 14:00)',
    attendanceStatus: 'Absent',
    currentAssignment: 'Loom #7 (Assigned backup standby)',
    availability: 'Available / Pool',
    overtimeHours: 0
  },
  {
    id: 'wrk_4',
    empId: 'EMP-WRK-104',
    name: 'S. Anitha',
    skill: 'Laser Pattern Cutter',
    department: 'Stitching',
    shedId: 'shed_a',
    shedName: 'Shed A',
    shift: 'General Shift (08:00 - 17:00)',
    attendanceStatus: 'Present',
    currentAssignment: 'Order TX-1024 / Cutting Table #2',
    availability: 'Active & Assigned',
    overtimeHours: 0
  },
  {
    id: 'wrk_5',
    empId: 'EMP-WRK-105',
    name: 'V. Velmurugan',
    skill: 'Dye Vat Technician',
    department: 'Dyeing',
    shedId: 'shed_b',
    shedName: 'Shed B',
    shift: 'General Shift (08:00 - 17:00)',
    attendanceStatus: 'Present',
    currentAssignment: 'Order TX-1025 / Fong Vat #4',
    availability: 'Active & Assigned',
    overtimeHours: 1
  },
  {
    id: 'wrk_6',
    empId: 'EMP-WRK-106',
    name: 'R. Meenakshi',
    skill: 'AQL 2.5 Fabric QA Inspector',
    department: 'Quality Assurance',
    shedId: 'shed_c',
    shedName: 'Shed C',
    shift: 'Morning Shift (06:00 - 14:00)',
    attendanceStatus: 'Present',
    currentAssignment: 'Order LP-901 / QA Table #1',
    availability: 'Active & Assigned',
    overtimeHours: 0
  }
];

const INITIAL_OVERTIME_REQUESTS: OvertimeRequest[] = [
  {
    id: 'OT-201',
    shedId: 'shed_a',
    shedName: 'Airjet Weaving & Stitching Shed A',
    requestedBy: 'Ramesh Kumar (Floor Supervisor)',
    workersCount: 4,
    hoursRequested: 2,
    shift: 'Evening Shift Overtime (14:00 - 16:00)',
    targetOrder: 'LP-902 (Urban Textiles)',
    reason: 'Expedite loom weaving pace to recover 35% daily variance deficit from raw fabric delay.',
    status: 'Pending',
    timestamp: 'Today 10:30 AM'
  }
];

const INITIAL_AUDIT_LOGS: ResourceAuditEntry[] = [
  {
    id: 'AUD-501',
    user: 'John Doe (Admin)',
    action: 'ORDER_ASSIGNED',
    entityType: 'Supervisor',
    entityId: 'usr_sup_1',
    details: 'Assigned Order LP-901 (5,000 pcs) to Ramesh Kumar in Shed A.',
    timestamp: '25 Oct 2026 09:30 AM'
  },
  {
    id: 'AUD-502',
    user: 'Ramesh Kumar (Supervisor)',
    action: 'BREAKDOWN_REPORTED',
    entityType: 'Machine',
    entityId: 'MCH-AJ-07',
    details: 'Logged warp tension sensor failure on Loom #7. Marked as Breakdown.',
    timestamp: '28 Oct 2026 11:15 AM'
  }
];

// =========================================================================
// PROPS INTERFACE
// =========================================================================

interface SupervisorsResourcesModuleProps {
  users?: AppUser[];
  orders?: Order[];
  onAssignSupervisor?: (orderId: string, supervisorId: string, supervisorName: string) => void;
  onApproveOvertime?: (shedName: string) => void;
}

export const SupervisorsResourcesModule: React.FC<SupervisorsResourcesModuleProps> = ({
  orders = [],
  onAssignSupervisor,
  onApproveOvertime
}) => {
  // Primary Tabs (Section 2: Only 2 primary tabs)
  const [activeTab, setActiveTab] = useState<'supervisors' | 'resources'>('supervisors');

  // Secondary Resource Views within Tab 2
  const [resourceSubView, setResourceSubView] = useState<'sheds' | 'machines' | 'workforce' | 'allocation'>('sheds');

  // Master State
  const [supervisors, setSupervisors] = useState<SupervisorProfile[]>(INITIAL_SUPERVISORS);
  const [sheds, setSheds] = useState<FactoryShed[]>(INITIAL_SHEDS);
  // Live API Machines Query
  const {
    data: machinesApiResponse,
    isLoading: isLoadingMachines,
    isFetching: isFetchingMachines,
    isError: isMachinesError,
    error: machinesError,
    refetch: refetchMachines,
  } = useGetMachinesQuery(undefined);

  const liveMachines: MachineItem[] = useMemo(() => {
    if (!machinesApiResponse) return [];
    const list = Array.isArray(machinesApiResponse)
      ? machinesApiResponse
      : Array.isArray(machinesApiResponse?.data)
      ? machinesApiResponse.data
      : [];
    return list.map(mapApiMachineToMachineItem);
  }, [machinesApiResponse]);

  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [hasLoadedMachinesApi, setHasLoadedMachinesApi] = useState(false);

  useEffect(() => {
    if (liveMachines.length > 0 && !hasLoadedMachinesApi) {
      setMachines(liveMachines);
      setHasLoadedMachinesApi(true);
    }
  }, [liveMachines, hasLoadedMachinesApi]);

  const handleRefreshMachines = async () => {
    const res = await refetchMachines();
    if (res.data) {
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.data)
        ? res.data.data
        : [];
      setMachines(list.map(mapApiMachineToMachineItem));
      showToast('Machinery telemetry refreshed from API.');
    }
  };

  const getMachineErrorMessage = (err: any): string => {
    if (!err) return 'Failed to fetch machines from server';
    if (typeof err === 'string') return err;
    if (err.data?.message) return err.data.message;
    if (err.error) return err.error;
    if (err.message) return err.message;
    return 'Unable to fetch machines from API. Please verify server connectivity.';
  };
  const [workforce, setWorkforce] = useState<WorkerItem[]>(INITIAL_WORKFORCE);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(INITIAL_OVERTIME_REQUESTS);
  const [auditLogs, setAuditLogs] = useState<ResourceAuditEntry[]>(INITIAL_AUDIT_LOGS);

  // Selections
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('usr_sup_1');
  const [selectedOrderToAssign, setSelectedOrderToAssign] = useState<string>('LP-903');
  const [selectedMachineShedFilter, setSelectedMachineShedFilter] = useState<string>('all');
  const [machineSearchQuery, setMachineSearchQuery] = useState<string>('');
  const [workerSearchQuery, setWorkerSearchQuery] = useState<string>('');
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>(['M-101']);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(['wrk_1']);

  // Modals
  const [showAddSupervisorModal, setShowAddSupervisorModal] = useState<boolean>(false);
  const [showSupervisorDetailModal, setShowSupervisorDetailModal] = useState<boolean>(false);
  const [showRegisterMachineModal, setShowRegisterMachineModal] = useState<boolean>(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState<boolean>(false);
  const [breakdownTargetMachine, setBreakdownTargetMachine] = useState<MachineItem | null>(null);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

  // Forms State
  const [newSupForm, setNewSupForm] = useState({
    name: '',
    designation: 'Floor Master',
    department: 'Airjet Weaving Shed A',
    assignedShedId: 'shed_a',
    shift: 'Morning Shift (06:00 - 14:00)' as ShiftType,
    email: '',
    phone: ''
  });

  const [newMachineForm, setNewMachineForm] = useState({
    name: 'Toyota JAT810 Airjet Loom #18',
    type: 'Airjet Loom',
    shedId: 'shed_a',
    operatingSpeed: '850 RPM'
  });

  const [createMachine, { isLoading: isRegisteringMachine }] = useCreateMachineMutation();
  const [registerMachineError, setRegisterMachineError] = useState<string | null>(null);

  const [updateMachineStatus, { isLoading: isUpdatingMachineStatus }] = useUpdateMachineStatusMutation();
  const [updatingMachineId, setUpdatingMachineId] = useState<string | null>(null);
  const [machineStatusError, setMachineStatusError] = useState<string | null>(null);

  const [createMaintenanceTicket, { isLoading: isReportingBreakdown }] = useCreateMaintenanceTicketMutation();
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [breakdownForm, setBreakdownForm] = useState({
    reason: 'Weft insertion nozzle clogging and air pressure leakage.',
    technician: 'K. Selvaraj (Lead Maintenance Engineer)'
  });

  const [newWorkerForm, setNewWorkerForm] = useState({
    name: '',
    skill: 'Airjet Loom Operator',
    department: 'Weaving',
    shedId: 'shed_a',
    shift: 'Morning Shift (06:00 - 14:00)' as ShiftType
  });

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // =========================================================================
  // DYNAMIC COMPUTATIONS & METRICS (Section 2)
  // =========================================================================

  // 1. Workers Present / Total Workers
  const totalWorkersCount = 45; // factory complement
  const totalWorkersPresent = workforce.filter((w) => w.attendanceStatus === 'Present').length + 38; // + factory floor count
  const workerAttendancePercent = Math.round((totalWorkersPresent / totalWorkersCount) * 100);

  // 2. Running Machines / Total Machines
  const totalMachinesCount = sheds.reduce((acc, s) => acc + s.totalMachines, 0); // 48
  const runningMachinesCount = sheds.reduce((acc, s) => acc + s.runningMachines, 0); // 35
  const runningMachinesPercent = Math.round((runningMachinesCount / totalMachinesCount) * 100);

  // 3. Available Daily Production Capacity
  const totalDailyCapacity = sheds.reduce((acc, s) => acc + s.dailyActualMeters, 0); // 2,780 m/day

  // 4. Machine Breakdowns
  const totalBreakdownMachines = machines.filter((m) => m.status === 'Breakdown').length;

  // Selected Supervisor profile
  const selectedSupervisor = useMemo(() => {
    return supervisors.find((s) => s.id === selectedSupervisorId) || supervisors[0];
  }, [supervisors, selectedSupervisorId]);

  // Orders assigned to selected supervisor
  const assignedOrders = useMemo(() => {
    return orders.filter((o) => o.assignedSupervisorId === selectedSupervisor?.id);
  }, [orders, selectedSupervisor]);

  // Filtered Machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (selectedMachineShedFilter !== 'all' && m.shedId !== selectedMachineShedFilter) return false;
      if (machineSearchQuery.trim()) {
        const q = machineSearchQuery.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [machines, selectedMachineShedFilter, machineSearchQuery]);

  // Filtered Workforce
  const filteredWorkforce = useMemo(() => {
    if (!workerSearchQuery.trim()) return workforce;
    const q = workerSearchQuery.toLowerCase();
    return workforce.filter((w) => w.name.toLowerCase().includes(q) || w.skill.toLowerCase().includes(q) || w.empId.toLowerCase().includes(q));
  }, [workforce, workerSearchQuery]);

  // =========================================================================
  // ACTIONS & OPERATIONAL LOGIC
  // =========================================================================

  // Assign Order with Workload Guard (Section 3B)
  const handleAssignOrderToSupervisor = () => {
    if (!selectedSupervisor) return;

    // Workload limit guard
    if (selectedSupervisor.workloadPercent >= 100) {
      alert(`Cannot assign order: Supervisor ${selectedSupervisor.name} is already at 100% capacity (${selectedSupervisor.activeOrdersCount}/${selectedSupervisor.maxOrderCapacity} orders). Please reassign to an available supervisor.`);
      return;
    }

    if (selectedSupervisor.attendanceStatus !== 'On Duty') {
      alert(`Cannot assign order: Supervisor ${selectedSupervisor.name} is currently ${selectedSupervisor.attendanceStatus}.`);
      return;
    }

    const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Update supervisor workload
    setSupervisors((prev) =>
      prev.map((s) => {
        if (s.id === selectedSupervisor.id) {
          const newCount = s.activeOrdersCount + 1;
          const newWorkload = Math.round((newCount / s.maxOrderCapacity) * 100);
          return {
            ...s,
            activeOrdersCount: newCount,
            workloadPercent: newWorkload,
            availabilityStatus: newWorkload >= 100 ? 'At Capacity' : 'Available'
          };
        }
        return s;
      })
    );

    // Append to audit log
    const auditEntry: ResourceAuditEntry = {
      id: `AUD-${Date.now()}`,
      user: 'John Doe (Admin)',
      action: 'ORDER_ASSIGNED',
      entityType: 'Supervisor',
      entityId: selectedSupervisor.id,
      details: `Assigned Order ${selectedOrderToAssign} to ${selectedSupervisor.name} (${selectedSupervisor.assignedShedName}).`,
      timestamp
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);

    // Parent callback if available
    if (onAssignSupervisor) {
      onAssignSupervisor(selectedOrderToAssign, selectedSupervisor.id, selectedSupervisor.name);
    }

    showToast(`Order ${selectedOrderToAssign} successfully assigned to ${selectedSupervisor.name}!`);
  };

  // Add Supervisor (Section 3B)
  const handleAddSupervisor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupForm.name.trim()) return;

    const newId = `usr_sup_${supervisors.length + 1}`;
    const newEmpId = `EMP-SUP-0${supervisors.length + 1}`;
    const shed = sheds.find((s) => s.id === newSupForm.assignedShedId);

    const newProfile: SupervisorProfile = {
      id: newId,
      empId: newEmpId,
      name: newSupForm.name,
      designation: newSupForm.designation,
      department: newSupForm.department,
      assignedShedId: newSupForm.assignedShedId,
      assignedShedName: shed?.name || 'Shed A',
      shift: newSupForm.shift,
      attendanceStatus: 'On Duty',
      activeOrdersCount: 0,
      maxOrderCapacity: 5,
      workloadPercent: 0,
      availabilityStatus: 'Available',
      email: newSupForm.email || `${newSupForm.name.toLowerCase().replace(/\s+/g, '.')}@loompilot.com`,
      phone: newSupForm.phone || '+91 98421 99000',
      joinedDate: 'Today',
      dailyTarget: 1500,
      dailyActual: 1500,
      targetAchievementPercent: 100,
      rejectionRatePercent: 0.5,
      materialWastagePercent: 0.5,
      delayedOrdersCount: 0,
      dailyReportStatus: 'Submitted',
      reportSubmittedAt: 'Shift Started'
    };

    setSupervisors((prev) => [...prev, newProfile]);
    showToast(`Supervisor ${newSupForm.name} registered and assigned to ${shed?.name}!`);
    setShowAddSupervisorModal(false);
  };

  // Register Machine (Section 4B)
  const handleRegisterMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegisteringMachine) return;
    setRegisterMachineError(null);

    const shed = sheds.find((s) => s.id === newMachineForm.shedId);
    const shedToProcessArea: Record<string, string> = {
      shed_a: 'knitting',
      shed_b: 'dyeing_processing',
      shed_c: 'cutting',
      shed_d: 'stitching',
    };
    const processArea = shedToProcessArea[newMachineForm.shedId] || 'knitting';
    const machineCode = `MCH-${newMachineForm.shedId.toUpperCase()}-${Date.now().toString().slice(-4)}`;

    try {
      await createMachine({
        machineCode,
        machineName: newMachineForm.name,
        processArea,
        capacityUnitsPerDay: 1000,
        machineType: newMachineForm.type,
      }).unwrap();

      const newMachine: MachineItem = {
        id: machineCode,
        name: newMachineForm.name,
        type: newMachineForm.type,
        shedId: newMachineForm.shedId,
        shedName: shed?.name.split(' ')[0] || 'Shed A',
        status: 'Idle',
        operatingHours: 0,
        operatingSpeed: newMachineForm.operatingSpeed,
        lastMaintenanceDate: 'Today',
        nextScheduledMaintenance: '30 Days'
      };

      setMachines((prev) => [newMachine, ...prev]);
      showToast(`Machine ${newMachine.name} registered in ${shed?.name || 'facility'}!`);
      setShowRegisterMachineModal(false);
      refetchMachines();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to register machine asset';
      setRegisterMachineError(errMsg);
    }
  };

  // Record Breakdown (Section 4B - Rule: broken machine cannot receive new allocations!)
  const handleRecordBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdownTargetMachine || isReportingBreakdown) return;
    setBreakdownError(null);

    // Resolve real backend machine ID
    const rawList = Array.isArray(machinesApiResponse?.data)
      ? machinesApiResponse.data
      : Array.isArray(machinesApiResponse)
      ? machinesApiResponse
      : [];
    const rawMachine = rawList.find(
      (rm: any) =>
        String(rm._id) === breakdownTargetMachine.id ||
        rm.id === breakdownTargetMachine.id ||
        rm.machineCode === breakdownTargetMachine.id
    );
    const realMachineId = rawMachine ? String(rawMachine._id || rawMachine.id) : breakdownTargetMachine.id;

    try {
      await createMaintenanceTicket({
        machineId: realMachineId,
        issue: breakdownForm.reason || 'Machine breakdown reported on floor',
        notes: breakdownForm.technician ? `Assigned Technician: ${breakdownForm.technician}` : undefined,
      }).unwrap();

      setMachines((prev) =>
        prev.map((m) => {
          if (m.id === breakdownTargetMachine.id) {
            return {
              ...m,
              status: 'Breakdown',
              breakdownReason: breakdownForm.reason,
              assignedTechnician: breakdownForm.technician,
            };
          }
          return m;
        })
      );

      // Update shed breakdown count
      setSheds((prev) =>
        prev.map((s) => {
          if (s.id === breakdownTargetMachine.shedId) {
            return {
              ...s,
              runningMachines: Math.max(0, s.runningMachines - 1),
              breakdownMachines: s.breakdownMachines + 1,
            };
          }
          return s;
        })
      );

      showToast(`Machine ${breakdownTargetMachine.id} logged as BREAKDOWN & ticket submitted to maintenance.`);
      setShowBreakdownModal(false);
      setBreakdownTargetMachine(null);
      refetchMachines();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to submit breakdown ticket to server';
      setBreakdownError(errMsg);
    }
  };

  // Mark Machine as Available (Section 4B)
  const handleMarkMachineAvailable = async (machineId: string) => {
    if (isUpdatingMachineStatus) return;
    setMachineStatusError(null);
    setUpdatingMachineId(machineId);

    // Resolve real backend machine ID
    const rawList = Array.isArray(machinesApiResponse?.data)
      ? machinesApiResponse.data
      : Array.isArray(machinesApiResponse)
      ? machinesApiResponse
      : [];
    const rawMachine = rawList.find(
      (rm: any) =>
        String(rm._id) === machineId ||
        rm.id === machineId ||
        rm.machineCode === machineId
    );
    const realMachineId = rawMachine ? String(rawMachine._id || rawMachine.id) : machineId;

    try {
      await updateMachineStatus({
        id: realMachineId,
        status: 'available',
        notes: 'Repair certified and marked available for production allocation.',
      }).unwrap();

      setMachines((prev) =>
        prev.map((m) => {
          if (m.id === machineId) {
            return {
              ...m,
              status: 'Idle',
              breakdownReason: undefined,
              assignedTechnician: undefined
            };
          }
          return m;
        })
      );

      showToast(`Machine ${machineId} repair certified! Now Available for production allocation.`);
      refetchMachines();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to update machine status on server';
      setMachineStatusError(errMsg);
      showToast(`Error: ${errMsg}`);
    } finally {
      setUpdatingMachineId(null);
    }
  };

  // Update Worker Attendance (Section 4C)
  const handleUpdateWorkerAttendance = (workerId: string, status: WorkerAttendance) => {
    setWorkforce((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            attendanceStatus: status,
            availability: status === 'Present' ? 'Active & Assigned' : 'On Leave'
          };
        }
        return w;
      })
    );
    showToast(`Worker attendance updated to ${status}.`);
  };

  // Approve Overtime Request (Section 4D)
  const handleApproveOvertime = (reqId: string) => {
    setOvertimeRequests((prev) =>
      prev.map((r) => {
        if (r.id === reqId) {
          return { ...r, status: 'Approved' };
        }
        return r;
      })
    );

    const targetReq = overtimeRequests.find((r) => r.id === reqId);
    if (targetReq) {
      setSheds((prev) =>
        prev.map((s) => {
          if (s.id === targetReq.shedId) {
            return { ...s, overtimeAuthorized: true };
          }
          return s;
        })
      );
      if (onApproveOvertime) {
        onApproveOvertime(targetReq.shedName);
      }
    }

    showToast(`Overtime request ${reqId} APPROVED (+2 hours shift authorized).`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* =========================================================================
          1. CLEAN PAGE HEADER
          ========================================================================= */}
      <div className="module-header-flat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0d10', letterSpacing: '-0.02em', margin: 0 }}>
            Supervisors & Resources
          </h1>
          
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowAuditModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 9999,
              padding: '6px 13px',
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <History size={13} color="#18191B" />
            Resource Audit Log
          </button>

          {activeTab === 'supervisors' ? (
            <button
              className="admin-btn-primary"
              onClick={() => setShowAddSupervisorModal(true)}
              style={{ padding: '6px 14px', fontSize: 11, borderRadius: 9999 }}
            >
              <Plus size={13} />
              Add Supervisor
            </button>
          ) : (
            <>
              <button
                onClick={handleRefreshMachines}
              disabled={isLoadingMachines || isFetchingMachines}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 9999,
                padding: '6px 13px',
                fontSize: 11,
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                opacity: (isLoadingMachines || isFetchingMachines) ? 0.6 : 1,
              }}
              title="Refresh machinery telemetry"
            >
              <RefreshCw size={13} className={(isLoadingMachines || isFetchingMachines) ? 'animate-spin' : ''} color="#18191B" />
              Refresh
            </button>

            <button
              className="admin-btn-primary"
              onClick={() => setShowRegisterMachineModal(true)}
              style={{ padding: '6px 14px', fontSize: 11, borderRadius: 9999 }}
            >
              <Plus size={13} />
              Register Machine
              </button>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. FOUR SUMMARY KPI INDICATORS (Section 2)
          ========================================================================= */}
      <div className="kpi-strip-flat">
        {/* KPI 1: Workers Present / Total */}
        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Workers Present / Total</span>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: '#F8F0DF',
              color: '#18191B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={14} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#18191B' }}>{totalWorkersPresent} / {totalWorkersCount}</span>
            <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700 }}>{workerAttendancePercent}% Present</span>
          </div>
        </div>

        {/* KPI 2: Running Machines / Total */}
        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Running Machines / Total</span>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={14} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#0a0d10' }}>{runningMachinesCount} / {totalMachinesCount}</span>
            <span style={{ fontSize: 10.5, color: '#0369a1', fontWeight: 700 }}>{runningMachinesPercent}% Active</span>
          </div>
        </div>

        {/* KPI 3: Available Daily Production Capacity */}
        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Daily Capacity Pace</span>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: '#ede9fe',
              color: '#5b21b6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={14} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#0a0d10' }}>{totalDailyCapacity.toLocaleString()}</span>
            <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>m / day run-rate</span>
          </div>
        </div>

        {/* KPI 4: Machine Breakdowns */}
        <div className="kpi-cell-flat" style={{ borderLeft: totalBreakdownMachines > 0 ? '3px solid #dc2626' : '1px solid #e5e9ee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Machine Breakdowns</span>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wrench size={14} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: totalBreakdownMachines > 0 ? '#dc2626' : '#18191B' }}>
              {totalBreakdownMachines} Breakdown{totalBreakdownMachines !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 10.5, color: totalBreakdownMachines > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
              {totalBreakdownMachines > 0 ? 'Technician dispatched' : 'All lines clear'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. TWO PRIMARY TABS (Section 2)
          ========================================================================= */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab('supervisors')}
          style={{
            padding: '6px 18px',
            borderRadius: 9999,
            border: activeTab === 'supervisors' ? '1px solid #edf2ee' : '1px solid #e2e8f0',
            background: activeTab === 'supervisors' ? '#F8F0DF' : '#ffffff',
            color: activeTab === 'supervisors' ? '#18191B' : '#64748b',
            fontSize: 11.5,
            fontWeight: activeTab === 'supervisors' ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Floor Supervisors ({supervisors.length})
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          style={{
            padding: '6px 18px',
            borderRadius: 9999,
            border: activeTab === 'resources' ? '1px solid #edf2ee' : '1px solid #e2e8f0',
            background: activeTab === 'resources' ? '#F8F0DF' : '#ffffff',
            color: activeTab === 'resources' ? '#18191B' : '#64748b',
            fontSize: 11.5,
            fontWeight: activeTab === 'resources' ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Machinery & Workforce Resources ({sheds.length} Sheds)
        </button>
      </div>

      {/* =========================================================================
          TAB 1: FLOOR SUPERVISORS WORKSPACE (Section 3)
          ========================================================================= */}
      {activeTab === 'supervisors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 16 }}>
          {/* LEFT: Supervisor Directory (Section 3A) */}
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e5e9ee',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardHat size={16} color="#18191B" />
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Supervisor Directory & Floor Responsibilities
                </h3>
              </div>
              <span style={{ fontSize: 10.5, color: '#64748b' }}>
                Click to inspect active orders & performance
              </span>
            </div>

            {/* Supervisor Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {supervisors.map((s) => {
                const isSelected = s.id === selectedSupervisorId;
                const activeSupOrders = orders.filter((o) => o.assignedSupervisorId === s.id);

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSupervisorId(s.id)}
                    style={{
                      background: isSelected ? '#f8fdfa' : '#ffffff',
                      border: isSelected ? '1.5px solid #79B4B7' : '1px solid #edf1f5',
                      padding: '12px 16px',
                      borderRadius: 18,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: isSelected ? '#79B4B7' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 800
                        }}>
                          {s.name.split(' ').map((n) => n[0]).join('')}
                        </span>
                        <div>
                          <strong style={{ fontSize: 13, color: '#0a0d10' }}>{s.name}</strong>
                          <span style={{ fontSize: 10.5, color: '#64748b', marginLeft: 6 }}>
                            ({s.designation}) &bull; <span style={{ color: '#0369a1', fontWeight: 600 }}>{s.empId}</span>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          background: s.attendanceStatus === 'On Duty' ? '#F8F0DF' : '#fee2e2',
                          color: s.attendanceStatus === 'On Duty' ? '#18191B' : '#dc2626',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontSize: 9.5,
                          fontWeight: 700
                        }}>
                          {s.attendanceStatus}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupervisorId(s.id);
                            setShowSupervisorDetailModal(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#18191B',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: '2px 6px'
                          }}
                        >
                          Performance &rarr;
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                      <span>Shed: <strong>{s.assignedShedName}</strong></span>
                      <span>Shift: {s.shift.split(' ')[0]}</span>
                    </div>

                    {/* Workload Progress Bar (Section 3A) */}
                    <div style={{ marginTop: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                        <span>Active Workload ({s.activeOrdersCount} / {s.maxOrderCapacity} orders):</span>
                        <strong style={{ color: s.workloadPercent >= 100 ? '#dc2626' : '#18191B' }}>
                          {s.workloadPercent}% ({s.availabilityStatus})
                        </strong>
                      </div>
                      <div style={{ height: 5, width: '100%', background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${s.workloadPercent}%`,
                            height: '100%',
                            background: s.workloadPercent >= 100 ? '#dc2626' : s.workloadPercent >= 75 ? '#f59e0b' : '#79B4B7'
                          }}
                        />
                      </div>
                    </div>

                    {/* Active Orders badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {activeSupOrders.map((ao) => (
                        <span
                          key={ao.id}
                          style={{
                            background: '#f1f5f9',
                            color: '#0369a1',
                            border: '1px solid #e2e8f0',
                            borderRadius: 4,
                            padding: '1px 6px',
                            fontSize: 9.5,
                            fontWeight: 700
                          }}
                        >
                          {ao.id} ({ao.productName})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Floor Assignment Desk (Section 3B) */}
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e5e9ee',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                FLOOR ASSIGNMENT DESK
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0a0d10', margin: '2px 0 0' }}>
                Assign Production Order to {selectedSupervisor?.name}
              </h3>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>
                Assigned Shed: <strong>{selectedSupervisor?.assignedShedName}</strong> &bull; Workload: <strong>{selectedSupervisor?.workloadPercent}%</strong>
              </div>
            </div>

            {/* Workload Guard Warning if at capacity */}
            {selectedSupervisor?.workloadPercent >= 100 ? (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: 14,
                padding: '8px 12px',
                fontSize: 11,
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <AlertTriangle size={15} color="#dc2626" />
                <span>Supervisor is at 100% capacity. Please reassign or select another supervisor.</span>
              </div>
            ) : null}

            {/* Order Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10' }}>
                Select Committed Order to Assign:
              </label>
              <select
                value={selectedOrderToAssign}
                onChange={(e) => setSelectedOrderToAssign(e.target.value)}
                className="admin-form-select"
                style={{ borderRadius: 12, fontSize: 11, padding: '7px 10px' }}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} &bull; {o.productName} ({o.quantityMeters.toLocaleString()}m) &bull; Currently: {o.assignedSupervisorName || 'Unassigned'}
                  </option>
                ))}
              </select>

              <button
                className="admin-btn-primary"
                onClick={handleAssignOrderToSupervisor}
                disabled={selectedSupervisor?.workloadPercent >= 100}
                style={{
                  marginTop: 4,
                  padding: '9px 16px',
                  fontSize: 11.5,
                  justifyContent: 'center',
                  opacity: selectedSupervisor?.workloadPercent >= 100 ? 0.5 : 1
                }}
              >
                <HardHat size={14} />
                <span>Confirm Assignment to {selectedSupervisor?.name}</span>
              </button>
            </div>

            {/* Currently Supervised Active Orders */}
            <div style={{ marginTop: 8 }}>
              <h4 style={{ fontSize: 12, fontWeight: 800, color: '#0a0d10', marginBottom: 8 }}>
                Active Production Orders Supervised by {selectedSupervisor?.name}:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {assignedOrders.length > 0 ? (
                  assignedOrders.map((ao) => (
                    <div
                      key={ao.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #edf1f5',
                        borderRadius: 14,
                        padding: '8px 12px',
                        fontSize: 11
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span style={{ color: '#0a0d10' }}>{ao.id} &bull; {ao.productName}</span>
                        <span style={{ color: '#18191B' }}>{ao.producedMeters.toLocaleString()} / {ao.quantityMeters.toLocaleString()} m</span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                        Deadline: {ao.deadlineDate} &bull; Phase: {ao.currentPhase}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic', padding: 8 }}>
                    No active orders currently assigned to this supervisor.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MACHINERY & WORKFORCE RESOURCES (Section 4)
          ========================================================================= */}
      {activeTab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sub-view Segment Pill Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 10, width: 'fit-content' }}>
            <button
              onClick={() => setResourceSubView('sheds')}
              style={{
                background: resourceSubView === 'sheds' ? '#ffffff' : 'transparent',
                color: resourceSubView === 'sheds' ? '#18191B' : '#64748b',
                border: 'none',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 10.5,
                fontWeight: resourceSubView === 'sheds' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Factory Sheds ({sheds.length})
            </button>
            <button
              onClick={() => setResourceSubView('machines')}
              style={{
                background: resourceSubView === 'machines' ? '#ffffff' : 'transparent',
                color: resourceSubView === 'machines' ? '#18191B' : '#64748b',
                border: 'none',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 10.5,
                fontWeight: resourceSubView === 'machines' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Machinery Inventory ({machines.length})
            </button>
            <button
              onClick={() => setResourceSubView('workforce')}
              style={{
                background: resourceSubView === 'workforce' ? '#ffffff' : 'transparent',
                color: resourceSubView === 'workforce' ? '#18191B' : '#64748b',
                border: 'none',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 10.5,
                fontWeight: resourceSubView === 'workforce' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Workforce & Shifts ({workforce.length})
            </button>
            <button
              onClick={() => setResourceSubView('allocation')}
              style={{
                background: resourceSubView === 'allocation' ? '#ffffff' : 'transparent',
                color: resourceSubView === 'allocation' ? '#18191B' : '#64748b',
                border: 'none',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 10.5,
                fontWeight: resourceSubView === 'allocation' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Resource Allocation Engine
            </button>
          </div>

          {/* SUB-VIEW 1: SHED-WISE RESOURCE OVERVIEW (Section 4A) */}
          {resourceSubView === 'sheds' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {sheds.map((shed) => {
                const otPending = overtimeRequests.find((r) => r.shedId === shed.id && r.status === 'Pending');

                return (
                  <div
                    key={shed.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e5e9ee',
                      borderRadius: 24,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                          {shed.name}
                        </h3>
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                          Supervisor: <strong>{shed.supervisorName}</strong>
                        </div>
                      </div>
                      <span style={{
                        background: '#F8F0DF',
                        color: '#18191B',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: 9.5,
                        fontWeight: 700
                      }}>
                        {shed.operatingSpeedText}
                      </span>
                    </div>

                    {/* Looms/Machines Metric Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                      <div style={{ background: '#f8fafc', padding: 8, borderRadius: 12, border: '1px solid #edf1f5', textAlign: 'center' }}>
                        <span style={{ color: '#64748b', fontSize: 9.5 }}>Running</span>
                        <strong style={{ color: '#16a34a', fontSize: 13, display: 'block' }}>{shed.runningMachines}</strong>
                      </div>
                      <div style={{ background: '#f8fafc', padding: 8, borderRadius: 12, border: '1px solid #edf1f5', textAlign: 'center' }}>
                        <span style={{ color: '#64748b', fontSize: 9.5 }}>Idle</span>
                        <strong style={{ color: '#64748b', fontSize: 13, display: 'block' }}>{shed.idleMachines}</strong>
                      </div>
                      <div style={{ background: '#f8fafc', padding: 8, borderRadius: 12, border: '1px solid #edf1f5', textAlign: 'center' }}>
                        <span style={{ color: '#64748b', fontSize: 9.5 }}>Breakdown</span>
                        <strong style={{ color: shed.breakdownMachines > 0 ? '#dc2626' : '#16a34a', fontSize: 13, display: 'block' }}>
                          {shed.breakdownMachines}
                        </strong>
                      </div>
                    </div>

                    {/* Workforce & Target Output */}
                    <div style={{ background: '#f8fafc', border: '1px solid #edf1f5', borderRadius: 14, padding: '10px 12px', fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0a0d10' }}>
                        <span>Weavers: {shed.workersPresent} / {shed.workersScheduled} Present</span>
                        <span style={{ color: shed.workersPresent >= shed.workersScheduled ? '#16a34a' : '#b45309' }}>
                          {Math.round((shed.workersPresent / shed.workersScheduled) * 100)}%
                        </span>
                      </div>
                      <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>
                        Run-Rate: <strong>{shed.dailyActualMeters} m/day</strong> (Target: {shed.dailyTargetMeters} m)
                      </div>
                      <div style={{ color: '#64748b', fontSize: 9.5, marginTop: 4, fontStyle: 'italic' }}>
                        Note: {shed.maintenanceNotes}
                      </div>
                    </div>

                    {/* Overtime Authorization Section (Section 4D) */}
                    <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                      {otPending ? (
                        <div style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: 12,
                          padding: '8px 10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ fontSize: 10, color: '#92400e' }}>
                            <strong>+2h Overtime Requested</strong> for {otPending.targetOrder}
                          </div>
                          <button
                            onClick={() => handleApproveOvertime(otPending.id)}
                            style={{
                              background: '#79B4B7', color: '#18191B',
                              border: 'none',
                              borderRadius: 9999,
                              padding: '4px 10px',
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Approve OT
                          </button>
                        </div>
                      ) : shed.overtimeAuthorized ? (
                        <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={13} />
                          Overtime (+2h) Authorized on Evening Shift
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: '#64748b' }}>Overtime on standby</span>
                          <button
                            onClick={() => {
                              setSelectedMachineShedFilter(shed.id);
                              setResourceSubView('machines');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#18191B',
                              fontSize: 10.5,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            View Machines &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SUB-VIEW 2: INDIVIDUAL MACHINE MANAGEMENT (Section 4B) */}
          {resourceSubView === 'machines' && (
            <div style={{
              background: '#ffffff',
              borderRadius: 24,
              border: '1px solid #e5e9ee',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} color="#18191B" />
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                    Machinery Inventory & Operating Telemetry
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f8faf9',
                    border: '1px solid #edf2ef',
                    borderRadius: 9999,
                    padding: '3px 8px',
                    fontSize: 10.5
                  }}>
                    <Search size={12} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search machine or ID..."
                      value={machineSearchQuery}
                      onChange={(e) => setMachineSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 10.5, width: 130 }}
                    />
                  </div>

                  <select
                    className="admin-form-select"
                    value={selectedMachineShedFilter}
                    onChange={(e) => setSelectedMachineShedFilter(e.target.value)}
                    style={{ fontSize: 10.5, padding: '3px 8px' }}
                  >
                    <option value="all">All Sheds</option>
                    <option value="shed_a">Shed A (Weaving)</option>
                    <option value="shed_b">Shed B (Dyeing)</option>
                    <option value="shed_c">Shed C (Warping)</option>
                  </select>
                </div>
              </div>

              {/* Error Alert */}
              {isMachinesError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 11 }}>
                    <AlertTriangle size={15} />
                    <span>Failed to fetch machinery: {getMachineErrorMessage(machinesError)}</span>
                  </div>
                  <button
                    onClick={() => refetchMachines()}
                    style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Machines Table (Unified Modern Design) */}
              <div className="modern-data-table-wrapper">
                <table className="modern-data-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input
                          type="checkbox"
                          className="modern-checkbox"
                          checked={filteredMachines.length > 0 && filteredMachines.every(m => selectedMachineIds.includes(m.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMachineIds(Array.from(new Set([...selectedMachineIds, ...filteredMachines.map(m => m.id)])));
                            } else {
                              const curIds = new Set(filteredMachines.map(m => m.id));
                              setSelectedMachineIds(selectedMachineIds.filter(id => !curIds.has(id)));
                            }
                          }}
                        />
                      </th>
                      <th>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Machine ID &amp; Name <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th>Shed</th>
                      <th>Speed / RPM</th>
                      <th>Assigned Order</th>
                      <th>Operating Hours</th>
                      <th>Status</th>
                      <th style={{ width: 44, textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingMachines && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
                            <RefreshCw size={14} className="animate-spin" color="#18191B" />
                            <span>Loading live machinery telemetry...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!isLoadingMachines && filteredMachines.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#101828' }}>
                            {machines.length === 0 ? 'No Machines Found in Database' : 'No Machines Match Filter'}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                            {machines.length === 0
                              ? 'No factory machinery records were returned by the API.'
                              : 'Try adjusting your search keywords or resetting the shed filter.'}
                          </div>
                        </td>
                      </tr>
                    )}
                    {!isLoadingMachines && filteredMachines.map((m) => {
                      const isSelected = selectedMachineIds.includes(m.id);
                      const isBroken = m.status === 'Breakdown';
                      const isRunning = m.status === 'Running';
                      const isMaintenance = m.status === 'Maintenance';

                      return (
                        <tr
                          key={m.id}
                          className={isSelected ? 'is-selected' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td
                            className="col-checkbox"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="modern-checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setSelectedMachineIds(selectedMachineIds.filter(id => id !== m.id));
                                } else {
                                  setSelectedMachineIds([...selectedMachineIds, m.id]);
                                }
                              }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: '#111827' }}>#{m.id}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{m.name}</div>
                          </td>
                          <td style={{ color: '#475569' }}>{m.shedName}</td>
                          <td style={{ color: '#18191B', fontWeight: 700 }}>{m.operatingSpeed}</td>
                          <td>
                            {m.assignedOrderId ? (
                              <span style={{ color: '#0369a1', fontWeight: 700 }}>
                                #{m.assignedOrderId} ({m.assignedStage})
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Unallocated</span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: 11.5 }}>{m.operatingHours} hrs</td>
                          <td>
                            <span className={`status-dot-pill ${isBroken ? 'failed' : isRunning ? 'fulfilled' : isMaintenance ? 'pending' : 'confirmed'}`}>
                              {m.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="modern-table-row-action"
                              title={isBroken ? "Mark Repaired" : "Breakdown / Options"}
                              disabled={isUpdatingMachineStatus && updatingMachineId === m.id}
                              onClick={() => {
                                if (isBroken) {
                                  handleMarkMachineAvailable(m.id);
                                } else {
                                  setBreakdownTargetMachine(m);
                                  setShowBreakdownModal(true);
                                }
                              }}
                            >
                              {isUpdatingMachineStatus && updatingMachineId === m.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <MoreHorizontal size={15} />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: WORKFORCE & SHIFTS (Section 4C) */}
          {resourceSubView === 'workforce' && (
            <div style={{
              background: '#ffffff',
              borderRadius: 24,
              border: '1px solid #e5e9ee',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="#18191B" />
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                    Workforce Directory & Shift Roster
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f8faf9',
                    border: '1px solid #edf2ef',
                    borderRadius: 9999,
                    padding: '3px 8px',
                    fontSize: 10.5
                  }}>
                    <Search size={12} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search worker or skill..."
                      value={workerSearchQuery}
                      onChange={(e) => setWorkerSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 10.5, width: 130 }}
                    />
                  </div>

                  <button
                    onClick={() => setShowAddWorkerModal(true)}
                    className="admin-btn-primary"
                    style={{ padding: '4px 12px', fontSize: 10.5, borderRadius: 9999 }}
                  >
                    <Plus size={12} />
                    Add Worker
                  </button>
                </div>
              </div>

              {/* Workforce Table (Unified Modern Design) */}
              <div className="modern-data-table-wrapper">
                <table className="modern-data-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input
                          type="checkbox"
                          className="modern-checkbox"
                          checked={filteredWorkforce.length > 0 && filteredWorkforce.every(w => selectedWorkerIds.includes(w.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedWorkerIds(Array.from(new Set([...selectedWorkerIds, ...filteredWorkforce.map(w => w.id)])));
                            } else {
                              const curIds = new Set(filteredWorkforce.map(w => w.id));
                              setSelectedWorkerIds(selectedWorkerIds.filter(id => !curIds.has(id)));
                            }
                          }}
                        />
                      </th>
                      <th>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Employee ID &amp; Name <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th>Skill / Specialization</th>
                      <th>Shed &amp; Shift</th>
                      <th>Assignment</th>
                      <th>Attendance</th>
                      <th style={{ width: 44, textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkforce.map((w) => {
                      const isSelected = selectedWorkerIds.includes(w.id);
                      const isPresent = w.attendanceStatus === 'Present';

                      return (
                        <tr
                          key={w.id}
                          className={isSelected ? 'is-selected' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td
                            className="col-checkbox"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="modern-checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== w.id));
                                } else {
                                  setSelectedWorkerIds([...selectedWorkerIds, w.id]);
                                }
                              }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: '#111827' }}>{w.name}</div>
                            <div style={{ fontSize: 9.5, color: '#0369a1', fontWeight: 600 }}>{w.empId}</div>
                          </td>
                          <td style={{ color: '#475569' }}>{w.skill}</td>
                          <td style={{ color: '#475569' }}>
                            {w.shedName} &bull; {w.shift.split(' ')[0]}
                          </td>
                          <td style={{ fontWeight: 600, color: '#111827' }}>
                            {w.currentAssignment}
                          </td>
                          <td>
                            <span className={`status-dot-pill ${isPresent ? 'fulfilled' : 'failed'}`}>
                              {w.attendanceStatus.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="modern-table-row-action"
                              title={`Toggle ${isPresent ? 'Absent' : 'Present'}`}
                              onClick={() => handleUpdateWorkerAttendance(w.id, isPresent ? 'Absent' : 'Present')}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 4: RESOURCE ALLOCATION ENGINE (Section 5) */}
          {resourceSubView === 'allocation' && (
            <div style={{
              background: '#ffffff',
              borderRadius: 24,
              border: '1px solid #e5e9ee',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Automated Resource Allocation & Capacity Evaluation
                </h3>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Evaluates operational machines (excluding breakdowns), present skilled workers, and supervisor workload limits.
                </div>
              </div>

              {/* Evaluation Card for LP-902 */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #edf2ee',
                borderRadius: 18,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#18191B', textTransform: 'uppercase' }}>
                      Recommended Resource Allocation for Order LP-902
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0a0d10', marginTop: 2 }}>
                      Urban Textiles &bull; Cotton Shirts (8,000 pcs)
                    </div>
                  </div>
                  <span style={{ background: '#F8F0DF', color: '#18191B', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>
                    Capacity Feasible
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11, background: '#ffffff', padding: 10, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Assigned Shed:</span>
                    <strong style={{ display: 'block', color: '#0a0d10' }}>Shed A (Weaving)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Assigned Supervisor:</span>
                    <strong style={{ display: 'block', color: '#0a0d10' }}>Ramesh Kumar (80% load)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Operational Machines:</span>
                    <strong style={{ display: 'block', color: '#16a34a' }}>Looms #12, #14 (Excludes Broken #7)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Assigned Workers:</span>
                    <strong style={{ display: 'block', color: '#0a0d10' }}>4 Operators Present</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: 10.5, color: '#475569' }}>
                    * Governance Rule: Loom #07 is excluded from allocation due to active breakdown status.
                  </div>
                  <button
                    onClick={() => showToast('Resource allocation plan for Order LP-902 confirmed by Admin!')}
                    className="admin-btn-primary"
                    style={{ padding: '6px 14px', fontSize: 11, borderRadius: 9999 }}
                  >
                    Confirm & Commit Allocation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: SUPERVISOR PERFORMANCE DETAIL (Section 3C)
          ========================================================================= */}
      {showSupervisorDetailModal && selectedSupervisor && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Supervisor Performance: {selectedSupervisor.name}
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {selectedSupervisor.empId} &bull; {selectedSupervisor.designation} &bull; {selectedSupervisor.assignedShedName}
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSupervisorDetailModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {/* Performance Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 12, border: '1px solid #edf1f5' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Daily Target vs Actual</span>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0a0d10', marginTop: 2 }}>
                    {selectedSupervisor.dailyActual} / {selectedSupervisor.dailyTarget} m
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 12, border: '1px solid #edf1f5' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Target Achievement</span>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                    {selectedSupervisor.targetAchievementPercent}%
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 12, border: '1px solid #edf1f5' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Quality Rejection</span>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0a0d10', marginTop: 2 }}>
                    {selectedSupervisor.rejectionRatePercent}%
                  </div>
                </div>
              </div>

              {/* Secondary Metrics */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '10px 12px',
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Material Wastage Rate:</span>
                  <span style={{ fontWeight: 700 }}>{selectedSupervisor.materialWastagePercent}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Orders at Risk / Delayed:</span>
                  <span style={{ fontWeight: 700, color: selectedSupervisor.delayedOrdersCount > 0 ? '#b45309' : '#16a34a' }}>
                    {selectedSupervisor.delayedOrdersCount} order(s)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Daily Shift Report Status:</span>
                  <span style={{ fontWeight: 700, color: '#18191B' }}>{selectedSupervisor.dailyReportStatus} ({selectedSupervisor.reportSubmittedAt})</span>
                </div>
              </div>

              <button
                onClick={() => setShowSupervisorDetailModal(false)}
                className="admin-btn-primary"
                style={{ width: '100%', padding: '9px 12px', fontSize: 11.5, justifyContent: 'center' }}
              >
                Close Performance Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD SUPERVISOR (Section 3B)
          ========================================================================= */}
      {showAddSupervisorModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 500, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                Register New Floor Supervisor
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAddSupervisorModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddSupervisor} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Balasubramaniam V."
                  value={newSupForm.name}
                  onChange={(e) => setNewSupForm({ ...newSupForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={newSupForm.designation}
                    onChange={(e) => setNewSupForm({ ...newSupForm, designation: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Assigned Shed
                  </label>
                  <select
                    className="admin-form-input"
                    value={newSupForm.assignedShedId}
                    onChange={(e) => setNewSupForm({ ...newSupForm, assignedShedId: e.target.value })}
                  >
                    {sheds.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Shift Assignment
                </label>
                <select
                  className="admin-form-input"
                  value={newSupForm.shift}
                  onChange={(e) => setNewSupForm({ ...newSupForm, shift: e.target.value as ShiftType })}
                >
                  <option value="Morning Shift (06:00 - 14:00)">Morning Shift (06:00 - 14:00)</option>
                  <option value="Evening Shift (14:00 - 22:00)">Evening Shift (14:00 - 22:00)</option>
                  <option value="General Shift (08:00 - 17:00)">General Shift (08:00 - 17:00)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  style={{ flex: 1, padding: '10px 14px', fontSize: 12, justifyContent: 'center' }}
                >
                  <Plus size={14} />
                  <span>Register Supervisor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSupervisorModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: LOG MACHINE BREAKDOWN (Section 4B)
          ========================================================================= */}
      {showBreakdownModal && breakdownTargetMachine && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', margin: 0 }}>
                  Record Machine Breakdown: {breakdownTargetMachine.id}
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {breakdownTargetMachine.name} &bull; {breakdownTargetMachine.shedName}
                </div>
              </div>
              <button className="modal-close-btn" disabled={isReportingBreakdown} onClick={() => !isReportingBreakdown && setShowBreakdownModal(false)}>
                <X size={15} />
              </button>
            </div>

            {breakdownError && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#B91C1C', fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} />
                  <span>{breakdownError}</span>
                </div>
                <button type="button" onClick={() => setBreakdownError(null)} style={{ background: 'transparent', border: 'none', color: '#B91C1C', cursor: 'pointer', fontWeight: 600 }}>&times;</button>
              </div>
            )}

            <form onSubmit={handleRecordBreakdown} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Breakdown Root Cause / Symptom
                </label>
                <textarea
                  className="admin-form-input"
                  rows={2}
                  value={breakdownForm.reason}
                  onChange={(e) => setBreakdownForm({ ...breakdownForm, reason: e.target.value })}
                  style={{ borderRadius: 12, resize: 'none' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Assigned Maintenance Technician
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={breakdownForm.technician}
                  onChange={(e) => setBreakdownForm({ ...breakdownForm, technician: e.target.value })}
                  required
                />
              </div>

              <div style={{ fontSize: 10.5, color: '#dc2626', background: '#fef2f2', padding: '8px 10px', borderRadius: 10 }}>
                * Rule: Logging breakdown removes this machine from available production capacity and blocks order allocations.
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={isReportingBreakdown}
                  style={{
                    flex: 1,
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isReportingBreakdown ? 'not-allowed' : 'pointer',
                    opacity: isReportingBreakdown ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {isReportingBreakdown ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Submitting Breakdown...</span>
                    </>
                  ) : (
                    <span>Confirm Breakdown Status</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isReportingBreakdown}
                  onClick={() => !isReportingBreakdown && setShowBreakdownModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#64748b',
                    cursor: isReportingBreakdown ? 'not-allowed' : 'pointer',
                    opacity: isReportingBreakdown ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: REGISTER MACHINE
          ========================================================================= */}
      {showRegisterMachineModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                Register Machinery Asset
              </h2>
              <button className="modal-close-btn" disabled={isRegisteringMachine} onClick={() => !isRegisteringMachine && setShowRegisterMachineModal(false)}>
                <X size={15} />
              </button>
            </div>

            {registerMachineError && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#B91C1C', fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} />
                  <span>{registerMachineError}</span>
                </div>
                <button type="button" onClick={() => setRegisterMachineError(null)} style={{ background: 'transparent', border: 'none', color: '#B91C1C', cursor: 'pointer', fontWeight: 600 }}>&times;</button>
              </div>
            )}

            <form onSubmit={handleRegisterMachine} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Machine Name / Model
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={newMachineForm.name}
                  onChange={(e) => setNewMachineForm({ ...newMachineForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Machine Type
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={newMachineForm.type}
                    onChange={(e) => setNewMachineForm({ ...newMachineForm, type: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Assigned Shed
                  </label>
                  <select
                    className="admin-form-input"
                    value={newMachineForm.shedId}
                    onChange={(e) => setNewMachineForm({ ...newMachineForm, shedId: e.target.value })}
                  >
                    {sheds.map((s) => (
                      <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Rated Operating Speed / RPM
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={newMachineForm.operatingSpeed}
                  onChange={(e) => setNewMachineForm({ ...newMachineForm, operatingSpeed: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={isRegisteringMachine}
                  className="admin-btn-primary"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: 12,
                    justifyContent: 'center',
                    opacity: isRegisteringMachine ? 0.6 : 1,
                    cursor: isRegisteringMachine ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isRegisteringMachine ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Registering Machine...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Register Machine</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isRegisteringMachine}
                  onClick={() => !isRegisteringMachine && setShowRegisterMachineModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#64748b',
                    cursor: isRegisteringMachine ? 'not-allowed' : 'pointer',
                    opacity: isRegisteringMachine ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: ADD WORKER
          ========================================================================= */}
      {showAddWorkerModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                Add Factory Worker
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAddWorkerModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newId = `wrk_${workforce.length + 1}`;
                const newEmpId = `EMP-WRK-1${workforce.length + 10}`;
                const shed = sheds.find((s) => s.id === newWorkerForm.shedId);

                const newWorker: WorkerItem = {
                  id: newId,
                  empId: newEmpId,
                  name: newWorkerForm.name,
                  skill: newWorkerForm.skill,
                  department: newWorkerForm.department,
                  shedId: newWorkerForm.shedId,
                  shedName: shed?.name.split(' ')[0] || 'Shed A',
                  shift: newWorkerForm.shift,
                  attendanceStatus: 'Present',
                  currentAssignment: 'Unassigned Pool',
                  availability: 'Available / Pool',
                  overtimeHours: 0
                };
                setWorkforce((prev) => [...prev, newWorker]);
                showToast(`Worker ${newWorker.name} added to roster!`);
                setShowAddWorkerModal(false);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}
            >
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Worker Full Name
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. T. Manikandan"
                  value={newWorkerForm.name}
                  onChange={(e) => setNewWorkerForm({ ...newWorkerForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Skill Specialization
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={newWorkerForm.skill}
                    onChange={(e) => setNewWorkerForm({ ...newWorkerForm, skill: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Assigned Shed
                  </label>
                  <select
                    className="admin-form-input"
                    value={newWorkerForm.shedId}
                    onChange={(e) => setNewWorkerForm({ ...newWorkerForm, shedId: e.target.value })}
                  >
                    {sheds.map((s) => (
                      <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  style={{ flex: 1, padding: '10px 14px', fontSize: 12, justifyContent: 'center' }}
                >
                  <Plus size={14} />
                  <span>Add to Roster</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: RESOURCE AUDIT LOG (Section 7)
          ========================================================================= */}
      {showAuditModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 680, borderRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                Supervisors & Resources Audit Log
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAuditModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>Audit ID</th>
                    <th style={{ padding: '8px 6px' }}>User</th>
                    <th style={{ padding: '8px 6px' }}>Action</th>
                    <th style={{ padding: '8px 6px' }}>Details</th>
                    <th style={{ padding: '8px 6px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0a0d10' }}>{log.id}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{log.user}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', color: '#475569' }}>{log.details}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{log.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOAST FEEDBACK
          ========================================================================= */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#79B4B7', color: '#18191B',
          borderRadius: 14,
          padding: '10px 18px',
          fontSize: 11.5,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 9999
        }}>
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
