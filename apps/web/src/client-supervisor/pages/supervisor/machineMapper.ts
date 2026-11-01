import { Machine } from '../../types/supervisor';

export function mapApiMachineToSupervisorMachine(m: any): Machine {
  const code = m.machineCode || m.id || String(m._id || '');
  const name = m.machineName || m.name || 'Textile Machine';
  const rawStatus = (m.currentStatus || m.status || '').toLowerCase();
  const area = (m.processArea || m.process || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  const type = (m.machineType || m.type || area || 'Industrial Machine').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

  let status: 'Running' | 'Breakdown' | 'Available' | 'Maintenance' = 'Available';
  let efficiency = '95.2%';
  let breakdownNote: string | undefined = undefined;

  if (rawStatus === 'breakdown') {
    status = 'Breakdown';
    efficiency = '0.0%';
    breakdownNote = m.breakdownNote || 'Sensor alert triggered. Maintenance ticket pending.';
  } else if (rawStatus === 'maint' || rawStatus === 'maintenance') {
    status = 'Maintenance';
    efficiency = '42.0%';
  } else if (rawStatus === 'available' || rawStatus === 'running') {
    status = 'Running';
    efficiency = '96.5%';
  } else if (rawStatus === 'inactive') {
    status = 'Available';
    efficiency = '0.0%';
  }

  let line = `${area || 'Main'} Line`;
  if (m.processArea === 'knitting') line = 'Knitting Bay 1';
  else if (m.processArea === 'dyeing_fabric_processing') line = 'Dyeing Vessel Bay';
  else if (m.processArea === 'cutting') line = 'Cutting Table #1';
  else if (m.processArea === 'stitching') line = 'Assembly Line #3';
  else if (m.processArea === 'checking') line = 'Inspection Line';
  else if (m.processArea === 'ironing_finishing') line = 'Steam Tunnel 1';
  else if (m.processArea === 'packing') line = 'Automated Bagging';

  const rpm = m.capacityUnitsPerDay ? Math.min(1200, Math.max(450, Math.round(m.capacityUnitsPerDay / 2.5))) : 800;

  return {
    id: code,
    name,
    type,
    process: area || 'Weaving',
    status,
    lastUpdated: m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active Telemetry',
    rpm,
    efficiency,
    assignedOrder: m.assignedOrder || 'LP-901',
    line,
    breakdownNote,
  };
}

export function mapApiMachineToMachineItem(m: any): any {
  const code = m.machineCode || m.id || String(m._id || '');
  const name = m.machineName || m.name || 'Textile Machine';
  const rawStatus = (m.currentStatus || m.status || '').toLowerCase();
  const area = (m.processArea || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  const type = (m.machineType || area || 'Industrial Machine').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

  let status: 'Running' | 'Idle' | 'Reserved' | 'Breakdown' | 'Maintenance' = 'Running';
  let breakdownReason: string | undefined = undefined;

  if (rawStatus === 'breakdown') {
    status = 'Breakdown';
    breakdownReason = 'Mechanical sensor fault detected in telemetry.';
  } else if (rawStatus === 'maint' || rawStatus === 'maintenance') {
    status = 'Maintenance';
  } else if (rawStatus === 'inactive') {
    status = 'Idle';
  } else if (rawStatus === 'available') {
    status = 'Running';
  }

  let shedId = 'shed_a';
  let shedName = 'Shed A';
  if (m.processArea === 'dyeing_fabric_processing') { shedId = 'shed_b'; shedName = 'Shed B'; }
  else if (m.processArea === 'cutting') { shedId = 'shed_c'; shedName = 'Shed C'; }
  else if (m.processArea === 'stitching') { shedId = 'shed_d'; shedName = 'Shed D'; }

  const operatingSpeed = m.capacityUnitsPerDay ? `${m.capacityUnitsPerDay} Units/Day` : '850 RPM';

  return {
    id: code,
    name,
    type,
    shedId,
    shedName,
    status,
    assignedOrderId: m.assignedOrder || 'LP-901',
    assignedStage: area || 'Production',
    operatingHours: 1400,
    operatingSpeed,
    lastMaintenanceDate: '15 Oct 2026',
    nextScheduledMaintenance: status === 'Breakdown' ? 'Under Repair' : '15 Nov 2026',
    breakdownReason,
    assignedTechnician: status === 'Breakdown' ? 'K. Selvaraj (Lead Maintenance Engineer)' : undefined,
  };
}

