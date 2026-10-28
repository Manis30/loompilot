import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Worker {
  id: string;
  tenantId: string;
  workerCode: string;
  name: string;
  skillLevel: "unskilled" | "semi_skilled" | "skilled";
  hourlyRatePaise: number;
  assignedProcessId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewWorker {
  tenantId: string;
  workerCode: string;
  name: string;
  skillLevel?: "unskilled" | "semi_skilled" | "skilled";
  hourlyRatePaise?: number;
  assignedProcessId?: string;
  active?: boolean;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  workerId: string;
  workerName?: string;
  date: string;
  isPresent: boolean;
  hoursWorked: number;
  createdAt: Date;
}

export interface AttendanceItem {
  workerId: string;
  date: string;
  isPresent: boolean;
  hoursWorked?: number;
}

export interface DailyOutput {
  id: string;
  tenantId: string;
  orderId: string;
  processId: string;
  date: string;
  quantityProduced: number;
  quantityDefective: number;
  operatorId?: string;
  notes?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewDailyOutput {
  tenantId: string;
  orderId: string;
  processId: string;
  date: string;
  quantityProduced: number;
  quantityDefective?: number;
  operatorId?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface IWorkforceRepository {
  createWorker(data: NewWorker, tx?: TxContext): Promise<Worker>;
  findWorkerById(tenantId: string, id: string, tx?: TxContext): Promise<Worker | null>;
  findWorkerByCode(tenantId: string, workerCode: string, tx?: TxContext): Promise<Worker | null>;
  listWorkers(tenantId: string, query?: ListQuery): Promise<Page<Worker>>;
  recordAttendance(tenantId: string, records: AttendanceItem[], tx?: TxContext): Promise<AttendanceRecord[]>;
  getAttendance(tenantId: string, date: string): Promise<AttendanceRecord[]>;
  findDailyOutputByIdempotencyKey(tenantId: string, idempotencyKey: string, tx?: TxContext): Promise<DailyOutput | null>;
  upsertDailyOutput(data: NewDailyOutput, tx?: TxContext): Promise<DailyOutput>;
  getOutputsForOrder(tenantId: string, orderId: string, tx?: TxContext): Promise<DailyOutput[]>;
}
