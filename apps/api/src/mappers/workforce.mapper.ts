import {
  Worker,
  AttendanceRecord,
  DailyOutput,
} from "../interfaces/workforce.repository.js";

export function toWorkerResponse(worker: Worker) {
  return {
    id: worker.id,
    _id: worker.id,
    tenantId: worker.tenantId,
    workerCode: worker.workerCode,
    name: worker.name,
    skillLevel: worker.skillLevel,
    hourlyRatePaise: worker.hourlyRatePaise,
    assignedProcessId: worker.assignedProcessId,
    active: worker.active,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}

export function toAttendanceResponse(attendance: AttendanceRecord) {
  return {
    id: attendance.id,
    _id: attendance.id,
    tenantId: attendance.tenantId,
    workerId: attendance.workerId,
    workerName: attendance.workerName,
    date: attendance.date,
    processId: attendance.processId,
    shift: attendance.shift,
    status: attendance.status,
    isPresent: attendance.isPresent,
    hoursWorked: attendance.hoursWorked,
    createdAt: attendance.createdAt,
  };
}

export function toDailyOutputResponse(output: DailyOutput) {
  return {
    id: output.id,
    _id: output.id,
    tenantId: output.tenantId,
    orderId: output.orderId,
    processId: output.processId,
    date: output.date,
    entries: output.entries,
    labourCostPaise: output.labourCostPaise,
    quantityProduced: output.quantityProduced,
    quantityDefective: output.quantityDefective,
    operatorId: output.operatorId,
    notes: output.notes,
    idempotencyKey: output.idempotencyKey,
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
  };
}

