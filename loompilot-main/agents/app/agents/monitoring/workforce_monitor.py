from datetime import datetime
from typing import Any, Dict, List, Optional
import pandas as pd

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.monitoring_schema import (
    EmployeeAttendanceItem,
    WorkforceMonitoringResponse,
)

logger = get_logger(__name__)


class WorkforceMonitor:
    """
    Deterministic workforce attendance and availability monitoring service.
    Analyzes workforce availability, identifies absent personnel, and evaluates
    staffing sufficiency against active manufacturing schedules while safeguarding employee privacy.
    """

    def __init__(self, repository: Optional[DataRepository] = None):
        self.repository = repository or get_data_repository()

    def get_workforce_overview(
        self,
        as_of_date: Optional[str] = None,
    ) -> WorkforceMonitoringResponse:
        """
        Evaluate employee attendance and workforce availability for a target date.
        Defaults to the latest date present in LoomPilot_Attendance if omitted.
        """
        self.repository._ensure_loaded()
        att_df = self.repository._attendance_df
        emp_df = self.repository._employees_df

        if att_df is None or att_df.empty or emp_df is None or emp_df.empty:
            logger.warning("Attendance or Employees dataset is empty or not loaded.")
            return WorkforceMonitoringResponse(
                asOfDate=as_of_date or "2026-10-31",
                totalEmployees=0,
                presentCount=0,
                absentCount=0,
                halfDayCount=0,
                leaveCount=0,
                workforceAvailabilityPct=0.0,
                absentEmployees=[],
                isWorkforceSufficient=False,
                workforceNotes="Attendance dataset is unavailable.",
            )

        # Determine target date
        if as_of_date is not None:
            target_dt = pd.to_datetime(as_of_date)
            daily_att = att_df[att_df["AttendanceDate"] == target_dt]
            date_str = str(as_of_date)[:10]
        else:
            max_dt = att_df["AttendanceDate"].max()
            daily_att = att_df[att_df["AttendanceDate"] == max_dt]
            date_str = str(max_dt)[:10]

        # If specific date has no records, fallback to latest observation
        if daily_att.empty:
            max_dt = att_df["AttendanceDate"].max()
            daily_att = att_df[att_df["AttendanceDate"] == max_dt]
            date_str = str(max_dt)[:10]

        # Map employee details for quick lookup
        emp_map = {}
        for _, r in emp_df.iterrows():
            emp_map[int(r["EmployeeID"])] = {
                "name": str(r["EmployeeName"]),
                "role": str(r.get("JobRole", "General Worker")),
            }

        total_scheduled = len(emp_df)
        present_cnt = 0
        absent_cnt = 0
        half_day_cnt = 0
        leave_cnt = 0
        absent_list: List[EmployeeAttendanceItem] = []

        logged_emp_ids = set()
        for _, row in daily_att.iterrows():
            e_id = int(row["EmployeeID"])
            logged_emp_ids.add(e_id)
            status = str(row.get("AttendanceStatus", "Present")).strip()
            hours = float(row.get("HoursWorked", 8.0)) if pd.notnull(row.get("HoursWorked")) else None

            emp_info = emp_map.get(e_id, {"name": f"Employee #{e_id}", "role": "Worker"})

            if status.lower() == "present":
                present_cnt += 1
            elif status.lower() in ("absent", "unexcused"):
                absent_cnt += 1
                absent_list.append(
                    EmployeeAttendanceItem(
                        employeeId=e_id,
                        employeeName=emp_info["name"],
                        jobRole=emp_info["role"],
                        attendanceStatus="Absent",
                        hoursWorked=0.0,
                    )
                )
            elif status.lower() in ("half day", "halfday"):
                half_day_cnt += 1
            elif status.lower() in ("leave", "on leave", "sick leave", "casual leave"):
                leave_cnt += 1
                absent_list.append(
                    EmployeeAttendanceItem(
                        employeeId=e_id,
                        employeeName=emp_info["name"],
                        jobRole=emp_info["role"],
                        attendanceStatus="Leave",
                        hoursWorked=0.0,
                    )
                )
            else:
                present_cnt += 1

        # Check for unlogged employees
        for e_id, info in emp_map.items():
            if e_id not in logged_emp_ids:
                absent_cnt += 1
                absent_list.append(
                    EmployeeAttendanceItem(
                        employeeId=e_id,
                        employeeName=info["name"],
                        jobRole=info["role"],
                        attendanceStatus="Not Reported",
                        hoursWorked=0.0,
                    )
                )

        # Workforce Availability formula: ((Present + 0.5 * HalfDay) / TotalEmployees) * 100
        effective_present = present_cnt + (0.5 * half_day_cnt)
        availability_pct = (
            round((effective_present / total_scheduled) * 100.0, 2)
            if total_scheduled > 0
            else 0.0
        )

        # Sufficiency evaluation
        is_sufficient = availability_pct >= 85.0 and absent_cnt <= 3
        if is_sufficient:
            notes = (
                f"Workforce availability is healthy at {availability_pct:.1f}% ({present_cnt} present out of {total_scheduled}). "
                "Staffing is sufficient across active production lines."
            )
        else:
            notes = (
                f"Workforce availability is constrained at {availability_pct:.1f}% ({absent_cnt} absent / on leave). "
                "Line balancing adjustments recommended to prevent stage throughput drop."
            )

        return WorkforceMonitoringResponse(
            asOfDate=date_str,
            totalEmployees=total_scheduled,
            presentCount=present_cnt,
            absentCount=absent_cnt,
            halfDayCount=half_day_cnt,
            leaveCount=leave_cnt,
            workforceAvailabilityPct=availability_pct,
            absentEmployees=absent_list,
            isWorkforceSufficient=is_sufficient,
            workforceNotes=notes,
        )

