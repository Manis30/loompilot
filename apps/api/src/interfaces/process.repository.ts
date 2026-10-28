import { ProcessName } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Process {
  id: string;
  tenantId: string;
  name: ProcessName;
  sequence: number;
  standardWastagePct: number;
  avgOutputPerWorkerHour: number;
  unit: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProcess {
  tenantId: string;
  name: ProcessName;
  sequence: number;
  standardWastagePct?: number;
  avgOutputPerWorkerHour?: number;
  unit?: string;
}

export interface IProcessRepository {
  create(data: NewProcess, tx?: TxContext): Promise<Process>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Process | null>;
  findByName(tenantId: string, name: ProcessName, tx?: TxContext): Promise<Process | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Process>>;
  listAllOrdered(tenantId: string, tx?: TxContext): Promise<Process[]>;
}

