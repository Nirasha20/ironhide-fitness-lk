import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Router paths (match routes defined in App.tsx)
const ROSTER_ROUTE = "/admin/staff";

const ATT_STATUSES = ["present", "late", "absent", "off"] as const;
type AttendanceStatus = typeof ATT_STATUSES[number];
const ATT_LABEL: Record<AttendanceStatus, string> = { present: "P", late: "L", absent: "A", off: "Off" };

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
  joinDate: string;
  employeeId: string;
  active: boolean;
  salary: number;
}

interface AttendanceRecord {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
}

import { getStaffMembers, getStaffAttendanceForDate, saveStaffAttendance, getAttendanceLockForDate, lockAttendanceForDate } from "../../lib/memberService";

const STAFF_KEY = "ironhide.staff"; // fallback if Firestore fails
const ATTENDANCE_KEY = "ironhide.attendance";

async function loadStaff(): Promise<StaffMember[]> {
  try {
    const docs = await getStaffMembers();
    return docs.map((d) => ({
      id: d.id,
      name: d.fullName,
      initials: d.fullName ? d.fullName.trim().split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) : "",
      role: d.role || "",
      email: d.email || "",
      phone: d.phone || "",
      joinDate: d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : todayStr(),
      employeeId: "EMP-" + d.id.slice(-6),
      active: d.status === "active",
      salary: (d as any).salary || 0,
    }));
  } catch (e) {
    try {
      const raw = localStorage.getItem(STAFF_KEY);
      return raw ? (JSON.parse(raw) as StaffMember[]) : [];
    } catch {
      return [];
    }
  }
}

async function loadAttendanceFor(date: string): Promise<AttendanceRecord[]> {
  let firestoreRecords: AttendanceRecord[] = [];
  try {
    const docs = await getStaffAttendanceForDate(date);
    firestoreRecords = docs.map((d) => ({
      staffId: d.staffId,
      date: d.date,
      status: d.note === "late" ? ("late" as AttendanceStatus) : (d.status as AttendanceStatus),
    }));
  } catch (e) {
    console.warn("loadAttendanceFor Firestore load failed", e);
  }

  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    const all = raw ? (JSON.parse(raw) as AttendanceRecord[]) : [];
    const localRecords = all.filter((a) => a.date === date);
    const merged = [...firestoreRecords.filter((f) => !localRecords.some((l) => l.staffId === f.staffId)), ...localRecords];
    return merged;
  } catch {
    return firestoreRecords;
  }
}

// Save a single attendance record to canonical staff_attendance via memberService
async function persistAttendanceRecord(record: AttendanceRecord) {
  try {
    // memberService does not have 'late' as a status; save as 'present' with a note
    const svcStatus: any = record.status === "late" ? "present" : record.status;
    const note = record.status === "late" ? "late" : "";
    await saveStaffAttendance({ staffId: record.staffId, date: record.date, status: svcStatus, note });
    return;
  } catch (e) {
    console.warn("persistAttendanceRecord Firestore save failed, using local fallback", e);
    // fallback: store in local key (merge)
    try {
      const raw = localStorage.getItem(ATTENDANCE_KEY);
      const all = raw ? (JSON.parse(raw) as AttendanceRecord[]) : [];
      const idx = all.findIndex((a) => a.staffId === record.staffId && a.date === record.date);
      if (idx !== -1) all[idx] = record;
      else all.push(record);
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(all));
      return;
    } catch (fallbackError) {
      console.error("persistAttendanceRecord local fallback failed", fallbackError);
      throw e;
    }
  }
}

const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", opts || { day: "2-digit", month: "short", year: "numeric" });
}

const Icon = ({ path, className = "" }: { path: string; className?: string }) => (
  <svg
    className={`icon ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const ICON = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userCog: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h3"/><circle cx="18" cy="18" r="3"/><path d="M18 14.5v.6M18 20.9v.6M14.5 18h.6M20.9 18h.6M15.5 15.5l.4.4M20.1 20.1l.4.4M20.5 15.5l-.4.4M15.9 20.1l-.4.4"/>',
};


const Avatar = ({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) => (
  <div className={`avatar avatar-${size}`}>{initials}</div>
);


export default function AttendancePage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [dateLocked, setDateLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attDate, setAttDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const mergeAttendanceRecords = (current: AttendanceRecord[], next: AttendanceRecord[]) => {
    const filtered = current.filter((a) => !next.some((n) => n.staffId === a.staffId && n.date === a.date));
    return [...filtered, ...next];
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [staffResult, attendanceResult, lockResult] = await Promise.allSettled([
          loadStaff(),
          loadAttendanceFor(attDate),
          getAttendanceLockForDate(attDate),
        ]);

        if (!active) return;

        setStaff(staffResult.status === "fulfilled" ? staffResult.value : []);
        if (attendanceResult.status === "fulfilled") {
          setAttendance((prev) => mergeAttendanceRecords(prev, attendanceResult.value));
        }
        setDateLocked(lockResult.status === "fulfilled" ? lockResult.value : false);
      } catch (error) {
        console.error("Failed to load attendance page data", error);
        if (active) {
          setStaff([]);
          setDateLocked(false);
        }
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const makePendingKey = (staffId: string, date: string) => `${staffId}:${date}`;

  const getAtt = (staffId: string, date: string) => {
    const key = makePendingKey(staffId, date);
    const pendingStatus = pendingAttendance[key];
    const base = attendance.find((a) => a.staffId === staffId && a.date === date);
    if (pendingStatus) {
      return base ? { ...base, status: pendingStatus } : { staffId, date, status: pendingStatus };
    }
    return base;
  };

  const markAttendance = (staffId: string, date: string, status: AttendanceStatus) => {
    if (dateLocked) return;
    const key = makePendingKey(staffId, date);
    const base = attendance.find((a) => a.staffId === staffId && a.date === date);
    const currentStatus = pendingAttendance[key] ?? base?.status;
    if (currentStatus === status) {
      setPendingAttendance((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setPendingAttendance((prev) => ({ ...prev, [key]: status }));
  };

  const savePendingAttendance = async () => {
    const todaysEntries = Object.entries(pendingAttendance).filter(([key]) => {
      const date = key.split(":")[1];
      return date === attDate;
    });
    if (!todaysEntries.length) return;

    setSaving(true);
    setSaveMessage(null);

    const results = await Promise.allSettled(
      todaysEntries.map(async ([key, status]) => {
        const [staffId, date] = key.split(":") as [string, string];
        const record: AttendanceRecord = { staffId, date, status };
        try {
          await persistAttendanceRecord(record);
          return { key, record };
        } catch (e) {
          console.error("savePendingAttendance failed", e, record);
          throw key;
        }
      })
    );

    const failures = results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason as string);
    const successfulRecords = results
      .filter((r): r is PromiseFulfilledResult<{ key: string; record: AttendanceRecord }> => r.status === "fulfilled")
      .map((r) => r.value.record);
    const successfulKeys = results
      .filter((r): r is PromiseFulfilledResult<{ key: string; record: AttendanceRecord }> => r.status === "fulfilled")
      .map((r) => r.value.key);

    if (successfulRecords.length > 0) {
      setAttendance((prev) => {
        const updated = prev.filter((a) => a.date !== attDate || !successfulRecords.some((r) => r.staffId === a.staffId));
        return [...updated, ...successfulRecords];
      });
    }

    let lockSuccess = false;
    if (successfulRecords.length > 0) {
      try {
        await lockAttendanceForDate(attDate);
        setDateLocked(true);
        lockSuccess = true;
      } catch (e) {
        console.error("lockAttendanceForDate failed", e);
        setSaveMessage("Attendance saved, but locking failed. Please retry.");
      }
    }

    setPendingAttendance((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([key, value]) => {
        const date = key.split(":")[1];
        if (date !== attDate) {
          next[key] = value;
          return;
        }
        if (failures.includes(key)) {
          next[key] = value;
          return;
        }
        if (!successfulKeys.includes(key)) {
          next[key] = value;
        }
      });
      return next;
    });

    if (failures.length > 0) {
      setSaveMessage(`${failures.length} record(s) failed to save.`);
    } else if (lockSuccess) {
      setSaveMessage("Attendance saved and date locked.");
    }

    setSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  useEffect(() => {
    // reload attendance when date changes
    let active = true;
    (async () => {
      if (!loaded) return;

      try {
        const [attendanceResult, lockResult] = await Promise.allSettled([
          loadAttendanceFor(attDate),
          getAttendanceLockForDate(attDate),
        ]);

        if (!active) return;

        if (attendanceResult.status === "fulfilled") {
          setAttendance((prev) => mergeAttendanceRecords(prev, attendanceResult.value));
        }
        setDateLocked(lockResult.status === "fulfilled" ? lockResult.value : false);
        setPendingAttendance((prev) => {
          const next: typeof prev = {};
          Object.entries(prev).forEach(([key, value]) => {
            const date = key.split(":")[1];
            if (date !== attDate) next[key] = value;
          });
          return next;
        });
      } catch (error) {
        console.error("Failed to reload attendance for selected date", error);
        if (active) {
          setDateLocked(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attDate, loaded]);

  const shiftDate = (delta: number) => {
    const [year, month, day] = attDate.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (next > todayStr()) return;
    setAttDate(next);
  };

  const activeStaff = staff.filter((s) => s.active);
  const present = activeStaff.filter((s) => getAtt(s.id, attDate)?.status === "present").length;
  const late = activeStaff.filter((s) => getAtt(s.id, attDate)?.status === "late").length;
  const absent = activeStaff.filter((s) => getAtt(s.id, attDate)?.status === "absent").length;
  const unmarked = activeStaff.filter((s) => !getAtt(s.id, attDate)).length;
  const isToday = attDate === todayStr();

  if (!loaded) {
    return (
      <>
        <Style />
        <div id="app">
          <div style={{ padding: 80, textAlign: "center", color: "var(--muted-soft)" }}>Loading staff portal…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Style />
      <div id="app">
        <div className="header-row">
          <div>
            <div className="brand-eyebrow">
              <span className="bar" />
              IRONHIDE OPERATIONS
            </div>
            <h1 className="page-title disp">Daily Attendance</h1>
            <div className="page-sub">
              <Icon path={ICON.userCog} />
              {activeStaff.length} active staff to mark
            </div>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi kpi-hero">
            <span className="kpi-label">Present Today</span>
            <span className="kpi-value disp">{present + late}</span>
            <span className="kpi-sub">{late} late</span>
          </div>
          <div className="kpi kpi-plain">
            <span className="kpi-label">Absent</span>
            <span className="kpi-value disp" style={{ color: "var(--amber)" }}>
              {absent}
            </span>
            <span className="kpi-sub">On {fmtDate(attDate)}</span>
          </div>
          <div className="kpi kpi-plain">
            <span className="kpi-label">Not Marked</span>
            <span className="kpi-value disp" style={{ color: "var(--muted)" }}>
              {unmarked}
            </span>
            <span className="kpi-sub">Still pending</span>
          </div>
          <div className="kpi kpi-plain">
            <span className="kpi-label">Active Staff</span>
            <span className="kpi-value disp" style={{ color: "var(--sky)" }}>
              {activeStaff.length}
            </span>
            <span className="kpi-sub">{staff.length} total registered</span>
          </div>
        </div>

        <div className="panel">
          <div className="tabs">
            <Link to={ROSTER_ROUTE} className="tab-btn">
              <Icon path={ICON.users} /> Staff Roster
            </Link>
            <button className="tab-btn active">
              <Icon path={ICON.calendar} /> Daily Attendance
            </button>
          </div>

          <div className="date-nav">
            <div className="date-nav-left">
              <button className="nav-arrow" onClick={() => shiftDate(-1)}>
                <Icon path={ICON.chevronLeft} />
              </button>
              <label className="date-picker-wrap">
                <span className="date-label">{fmtDate(attDate)}</span>
                <input
                  type="date"
                  className="date-picker"
                  value={attDate}
                  max={todayStr()}
                  onChange={(e) => setAttDate(e.target.value)}
                />
              </label>
              <button className="nav-arrow" onClick={() => shiftDate(1)} disabled={isToday}>
                <Icon path={ICON.chevronRight} />
              </button>
              {isToday && <span className="today-chip">Today</span>}
            </div>
            <div className="stat-legend">
              <span style={{ color: "var(--emerald)" }}>
                <span className="dot" style={{ background: "var(--emerald)" }} />
                Present: {present + late}
              </span>
              <span style={{ color: "var(--red)" }}>
                <span className="dot" style={{ background: "var(--red)" }} />
                Absent: {absent}
              </span>
              <span style={{ color: "var(--muted)" }}>
                <span className="dot" style={{ background: "var(--muted)" }} />
                Unmarked: {unmarked}
              </span>
            </div>
          </div>

          {!dateLocked && Object.keys(pendingAttendance).filter((key) => key.split(":")[1] === attDate).length > 0 && (
            <div className="save-banner">
              <div>
                <strong>{Object.keys(pendingAttendance).filter((key) => key.split(":")[1] === attDate).length}</strong> pending attendance mark(s) on {fmtDate(attDate)}.
              </div>
              <div className="save-actions">
                <button className="btn btn-primary" onClick={savePendingAttendance} disabled={saving}>
                  {saving ? "Saving…" : "Save Attendance"}
                </button>
                {saveMessage && <span className="save-message">{saveMessage}</span>}
              </div>
            </div>
          )}
          {dateLocked && (
            <div className="lock-banner">This date is locked for attendance and cannot be edited.</div>
          )}

          {activeStaff.length === 0 ? (
            <div className="empty-panel">
              <div className="empty-title">No active staff to mark</div>
              <div>Add a staff member on the Staff Roster page first, then come back here to record attendance.</div>
            </div>
          ) : (
            <>
              <div>
                {activeStaff.map((s) => {
                  const key = makePendingKey(s.id, attDate);
                  const att = getAtt(s.id, attDate);
                  const isPending = key in pendingAttendance;
                  return (
                    <div className="att-row" key={s.id}>
                      <Avatar initials={s.initials} size="md" />
                      <div className="att-info">
                        <div className="att-name">{s.name}</div>
                        <div className="att-meta">
                          <span>{s.role}</span>
                          {att?.checkIn && (
                            <span>
                              <Icon path={ICON.clock} />
                              {att.checkIn}
                              {att.checkOut ? ` → ${att.checkOut}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* department removed */}
                      {att ? (
                        <>
                          <span className={`badge att-${att.status}`}>{att.status.charAt(0).toUpperCase() + att.status.slice(1)}</span>
                          {isPending && <span className="pending-chip">Pending</span>}
                        </>
                      ) : (
                        <span className="not-marked">Not marked</span>
                      )}
                      <div className="mark-group">
                        {ATT_STATUSES.map((st) => (
                          <button
                            key={st}
                            className={`mark-btn ${att?.status === st ? "active-" + st : ""}`}
                            onClick={() => markAttendance(s.id, attDate, st)}
                            disabled={dateLocked}
                          >
                            {ATT_LABEL[st]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="legend-bar">
                <b>Legend:</b>
                <span>
                  <b style={{ color: "var(--emerald)" }}>P</b> = Present
                </span>
                <span>
                  <b style={{ color: "var(--amber)" }}>L</b> = Late
                </span>
                <span>
                  <b style={{ color: "var(--red)" }}>A</b> = Absent
                </span>
                <span>
                  <b>Off</b> = Day Off
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}


function Style() {
  return (
    <style>{`
:root{
  --bg:#101013; --card:#18181d; --card-raised:#1e1e25; --border:#2a2a33; --border-soft:#232329;
  --foreground:#f2f2f5; --muted:#8c8c97; --muted-soft:#6b6b76; --primary:#e2452f; --primary-soft:rgba(226,69,47,0.12);
  --emerald:#34d399; --emerald-soft:rgba(52,211,153,0.12); --amber:#f5b942; --amber-soft:rgba(245,185,66,0.12);
  --red:#f0564a; --red-soft:rgba(240,86,74,0.12); --sky:#4fb8e8; --sky-soft:rgba(79,184,232,0.12);
  --violet:#a78bfa; --violet-soft:rgba(167,139,250,0.12); --slate:#9aa1ac; --slate-soft:rgba(154,161,172,0.12);
}
*{box-sizing:border-box;}
#app{max-width:1180px; margin:0 auto; padding:28px 20px 60px; font-family:'Inter',sans-serif; color:var(--foreground); background:var(--bg);}
.disp{font-family:'Barlow Condensed',sans-serif; letter-spacing:0.01em;}
.mono{font-family:'JetBrains Mono',monospace;}
.header-row{display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:22px;}
.brand-eyebrow{display:flex; align-items:center; gap:8px; color:var(--primary); font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; margin-bottom:6px;}
.brand-eyebrow .bar{width:16px; height:2px; background:var(--primary); display:inline-block;}
h1.page-title{font-size:34px; font-weight:800; text-transform:uppercase; margin:0; line-height:1;}
.page-sub{color:var(--muted); font-size:13px; margin-top:6px; display:flex; align-items:center; gap:6px;}
.icon{width:15px; height:15px; flex-shrink:0;}
.kpi-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:22px;}
@media(max-width:820px){.kpi-grid{grid-template-columns:repeat(2,1fr);}}
.kpi{border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:6px; border:1px solid var(--border);}
.kpi-hero{background:linear-gradient(145deg,var(--primary),#b5321f); border-color:transparent;}
.kpi-plain{background:var(--card);}
.kpi-label{font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.14em;}
.kpi-hero .kpi-label{color:rgba(255,255,255,0.65);}
.kpi-plain .kpi-label{color:var(--muted);}
.kpi-value{font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:34px; line-height:1;}
.kpi-hero .kpi-value{color:#fff;}
.kpi-sub{font-size:11.5px;}
.kpi-hero .kpi-sub{color:rgba(255,255,255,0.55);}
.kpi-plain .kpi-sub{color:var(--muted-soft);}
.panel{background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden;}
.tabs{display:flex; border-bottom:1px solid var(--border);}
.tab-btn{display:flex; align-items:center; gap:8px; padding:14px 22px; font-size:13.5px; font-weight:700; background:none; border:none; border-bottom:2px solid transparent; color:var(--muted); cursor:pointer;}
.tab-btn.active{color:var(--primary); border-bottom-color:var(--primary);}
.tab-btn{text-decoration:none;}
.tab-btn:hover:not(.active){color:var(--foreground);}
.badge{display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; border:1px solid transparent; white-space:nowrap;}
.dot{width:6px; height:6px; border-radius:50%; display:inline-block;}
.dept-Training{color:var(--sky); background:var(--sky-soft); border-color:rgba(79,184,232,0.25);}
.dept-Reception{color:var(--violet); background:var(--violet-soft); border-color:rgba(167,139,250,0.25);}
.dept-Management{color:var(--amber); background:var(--amber-soft); border-color:rgba(245,185,66,0.25);}
.dept-Maintenance{color:var(--slate); background:var(--slate-soft); border-color:rgba(154,161,172,0.25);}
.dept-Nutrition{color:var(--emerald); background:var(--emerald-soft); border-color:rgba(52,211,153,0.25);}
.att-present{color:var(--emerald); background:var(--emerald-soft); border-color:rgba(52,211,153,0.3);}
.att-late{color:var(--amber); background:var(--amber-soft); border-color:rgba(245,185,66,0.3);}
.att-absent{color:var(--red); background:var(--red-soft); border-color:rgba(240,86,74,0.3);}
.att-off{color:var(--muted); background:rgba(255,255,255,0.05); border-color:var(--border);}
.avatar{border-radius:50%; background:linear-gradient(145deg,#2c2c36,#1c1c22); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--foreground); flex-shrink:0; font-family:'Barlow Condensed',sans-serif;}
.avatar-sm{width:32px; height:32px; font-size:12px;}
.avatar-md{width:40px; height:40px; font-size:14px;}
.avatar-lg{width:52px; height:52px; font-size:18px;}
.date-nav{display:flex; align-items:center; justify-content:space-between; padding:13px 20px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:10px;}
.date-nav-left{display:flex; align-items:center; gap:10px;}
.nav-arrow{width:28px; height:28px; border-radius:8px; background:var(--card-raised); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; color:var(--muted); cursor:pointer;}
.nav-arrow:hover{color:var(--foreground); background:#25252d;}
.nav-arrow:disabled{opacity:0.3; cursor:not-allowed;}
.date-label{font-weight:700; font-size:14px;}
.date-picker-wrap{position:relative; display:inline-flex; align-items:center;}
.date-picker{position:absolute; inset:0; opacity:0; cursor:pointer;}
.today-chip{font-size:10.5px; font-weight:700; color:var(--primary); background:var(--primary-soft); border:1px solid rgba(226,69,47,0.25); padding:2px 9px; border-radius:999px;}
.stat-legend{display:flex; align-items:center; gap:16px; font-size:12px; font-weight:600; flex-wrap:wrap;}
.stat-legend span{display:flex; align-items:center; gap:6px;}
.att-row{display:flex; align-items:center; gap:14px; padding:14px 20px; border-bottom:1px solid var(--border-soft);}
.att-row:last-child{border-bottom:none;}
.att-row:hover{background:rgba(255,255,255,0.02);}
.att-info{flex:1; min-width:0;}
.att-name{font-weight:600;}
.att-meta{font-size:11.5px; color:var(--muted-soft); display:flex; align-items:center; gap:10px; margin-top:2px;}
.att-meta span{display:flex; align-items:center; gap:4px;}
.att-meta svg{width:10.5px; height:10.5px;}
.not-marked{font-size:11.5px; font-style:italic; color:var(--muted-soft);}
.mark-group{display:flex; align-items:center; gap:6px; flex-shrink:0;}
.mark-btn{padding:7px 11px; border-radius:8px; font-size:11.5px; font-weight:800; border:1px solid var(--border); background:var(--card-raised); color:var(--muted); cursor:pointer; min-width:38px; text-align:center;}
.mark-btn:hover{color:var(--foreground); background:#26262e;}
.mark-btn.active-present{background:var(--emerald-soft); border-color:rgba(52,211,153,0.4); color:var(--emerald);}
.mark-btn.active-late{background:var(--amber-soft); border-color:rgba(245,185,66,0.4); color:var(--amber);}
.mark-btn.active-absent{background:var(--red-soft); border-color:rgba(240,86,74,0.4); color:var(--red);}
.mark-btn.active-off{background:rgba(255,255,255,0.07); border-color:var(--border); color:var(--foreground);}
.pending-chip{font-size:11px; font-weight:700; color:var(--sky); background:rgba(79,184,232,0.12); border-radius:999px; padding:2px 8px; margin-left:10px;}
.save-banner{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 18px; margin:0 20px 16px; border:1px solid rgba(100,100,120,0.18); border-radius:14px; background:rgba(56,56,70,0.95);}
.lock-banner{margin:0 20px 16px; padding:14px 18px; border-radius:14px; background:rgba(52,211,153,0.12); border:1px solid rgba(52,211,153,0.25); color:var(--emerald);}
.save-actions{display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
.btn{border:none; outline:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer;}
.btn-primary{background:var(--emerald); color:#08130d;}
.btn-primary:disabled{opacity:0.55; cursor:not-allowed;}
.save-message{color:var(--sky); font-size:13px;}
.legend-bar{padding:12px 20px; border-top:1px solid var(--border); display:flex; align-items:center; gap:18px; font-size:11.5px; color:var(--muted); flex-wrap:wrap;}
.legend-bar b{color:var(--foreground);}
.empty-panel{padding:60px 20px; text-align:center; color:var(--muted-soft);}
.empty-panel .empty-title{font-weight:700; color:var(--muted); font-size:15px; margin-bottom:6px;}
    `}</style>
  );
}