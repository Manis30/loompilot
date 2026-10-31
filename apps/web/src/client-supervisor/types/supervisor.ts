export interface SupervisorProfile {
  name: string;
  title: string;
  empId: string;
  email: string;
  phone: string;
  department: string;
  area: string;
  shift: string;
  facility: string;
  reportingTo: string;
  avatar: string;
  status: string;
  joinedDate: string;
  experience: string;
  certifications: string[];
}

export interface SupervisorOrder {
  id: string;
  fabricName: string;
  clientName: string;
  assignedDate: string;
  assignedTime: string;
  totalQty: number;
  producedQty: number;
  remainingQty: number;
  deliveryDeadline: string;
  currentStage: string;
  status: 'In Progress' | 'Newly Assigned' | 'At Risk' | 'Completed' | 'Not Started';
  isNew: boolean;
  dailyTarget: number;
  specs: {
    composition: string;
    weavePattern: string;
    gsm: string;
    warpYarn: string;
    weftYarn: string;
    reedSpace: string;
    density: string;
    assignedLooms: string;
    colorCode: string;
  };
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  station: string;
  shift: string;
  deployment: string;
  status: string;
  skill: 'Master' | 'Expert' | 'Senior' | 'Advanced' | 'Intermediate' | 'Junior';
  experience: string;
  avatar: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  composition: string;
  category: 'Cotton Yarns' | 'Warp Beams' | 'Chemicals & Dyes' | 'Synthetic & Blends';
  inStockQty: number;
  unit: string;
  allocatedOrder: string;
  orderName: string;
  storageLocation: string;
  thresholdQty: number;
  status: 'In Stock' | 'Low Stock' | 'Ready for Loom';
  lastReceived: string;
  supplier: string;
  yarnCount: string;
  csp: string;
  twistPerInch: string;
  moistureRegain: string;
}

export interface Machine {
  id: string;
  name: string;
  type: string;
  process: string;
  status: 'Running' | 'Breakdown' | 'Available' | 'Maintenance';
  lastUpdated: string;
  rpm: number;
  efficiency: string;
  assignedOrder: string;
  line: string;
  breakdownNote?: string;
}

export interface ProductionLog {
  id: string;
  orderId: string;
  fabricName: string;
  date: string;
  process: string;
  dailyTarget: number;
  actualQty: number;
  defectiveQty: number;
  notes: string;
  supervisor: string;
  timestamp: string;
}

export interface IssueTicket {
  id: string;
  category: string;
  relatedOrder: string;
  machineId: string;
  date: string;
  time: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  impact: string;
  status: 'Technician Assigned' | 'Under Investigation' | 'Resolved' | 'Open';
  adminResponse?: string;
}

export interface SupervisorNotification {
  id: string;
  type: 'order' | 'breakdown' | 'deadline' | 'admin';
  title: string;
  message: string;
  timestamp: string;
  timeFormatted: string;
  isRead: boolean;
  linkPage: string;
  refId: string;
}

