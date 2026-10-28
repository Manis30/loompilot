import { Process } from "../interfaces/process.repository.js";

export function toProcessResponse(processItem: Process) {
  return {
    id: processItem.id,
    _id: processItem.id,
    tenantId: processItem.tenantId,
    name: processItem.name,
    sequence: processItem.sequence,
    standardWastagePct: processItem.standardWastagePct,
    avgOutputPerWorkerHour: processItem.avgOutputPerWorkerHour,
    unit: processItem.unit,
    createdAt: processItem.createdAt,
    updatedAt: processItem.updatedAt,
  };
}
