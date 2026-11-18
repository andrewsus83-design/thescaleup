"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls, textareaCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { cancelLeave, decideLeave, requestLeave, savePerson, saveWorkSettings, setPersonStatus } from "@/lib/hub/hr-actions";
import { EMPLOYMENT, EMPLOYMENT_LABEL, LEAVE_KINDS, LEAVE_LABEL, LIMITS, WORKDAYS_LABEL, type HrSettings, type Person } from "@/lib/hub/hr/model";

const selectCls = `${inputCls} appearance-auto`;

function Notes({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone="ok" role="status">
          {state.message}
        </Alert>
      )}
    </div>
  );
}
const Spin = ({ on }: { on: boolean }) => (on ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null);

/** Add a person, or change one. The fields are controlled so a failed save never loses what was typed. */
export function PersonForm({ brandId, person, emergency, members }: { brandId: string; person?: Person; emergency?: string; members: { userId: string; email: string }[] }) {
  const blank = { name: "", title: "", employment: "full_time", startDate: "", endDate: "", leaveDays: "", emergency: "", userId: "" };
  const [v, setV] = useState(
    person
      ? { name: person.name, title: person.title, employment: person.employment as string, startDate: person.startDate ?? "", endDate: person.endDate ?? "", leaveDays: person.leaveDays === null ? "" : String(person.leaveDays), emergency: emergency ?? "", userId: person.userId ?? "" }
      : blank,
  );
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((old) => ({ ...old, [k]: e.target.value }));
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await savePerson(prev, fd);
    if (r.message && !person) setV(blank);
    return r;
  }, {});
  const id = person?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      {person && <input type="hidden" name="personId" value={person.id} />}
      <Notes state={state} />
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <div>
          <label htmlFor={`p-name-${id}`} className={labelCls}>
            Full name
          </label>
          <input id={`p-name-${id}`} name="name" value={v.name} onChange={set("name")} maxLength={LIMITS.name} required autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor={`p-title-${id}`} className={labelCls}>
            Job title
          </label>
          <input id={`p-title-${id}`} name="title" value={v.title} onChange={set("title")} maxLength={LIMITS.title} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor={`p-emp-${id}`} className={labelCls}>
            Employment
          </label>
          <select id={`p-emp-${id}`} name="employment" value={v.employment} onChange={set("employment")} className={selectCls}>
            {EMPLOYMENT.map((e) => (
              <option key={e} value={e}>
                {EMPLOYMENT_LABEL[e]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`p-user-${id}`} className={labelCls}>
            Sign-in to the hub
          </label>
          <select id={`p-user-${id}`} name="userId" value={v.userId} onChange={set("userId")} className={selectCls} aria-describedby={`p-user-hint-${id}`}>
            <option value="">No sign-in</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email}
              </option>
            ))}
          </select>
          <p id={`p-user-hint-${id}`} className="mt-2 text-caption text-ink-500">
            Linking a sign-in lets this person ask for leave and shows their clock-ins in Attendance.
          </p>
        </div>
        <div>
          <label htmlFor={`p-start-${id}`} className={labelCls}>
            Start date
          </label>
          <input id={`p-start-${id}`} name="startDate" type="date" value={v.startDate} onChange={set("startDate")} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`p-end-${id}`} className={labelCls}>
            Contract end date
          </label>
          <input id={`p-end-${id}`} name="endDate" type="date" value={v.endDate} onChange={set("endDate")} className={inputCls} aria-describedby={`p-end-hint-${id}`} />
          <p id={`p-end-hint-${id}`} className="mt-2 text-caption text-ink-500">
            Leave empty for a job with no end date.
          </p>
        </div>
        <div>
          <label htmlFor={`p-leave-${id}`} className={labelCls}>
            Annual leave days a year
          </label>
          <input id={`p-leave-${id}`} name="leaveDays" inputMode="numeric" value={v.leaveDays} onChange={set("leaveDays")} maxLength={3} placeholder="Same as the team" className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor={`p-emg-${id}`} className={labelCls}>
          Emergency contact
        </label>
        <textarea id={`p-emg-${id}`} name="emergency" value={v.emergency} onChange={set("emergency")} maxLength={LIMITS.emergency} rows={2} placeholder="Name, relation and phone number" className={textareaCls} aria-describedby={`p-emg-hint-${id}`} />
        <p id={`p-emg-hint-${id}`} className="mt-2 text-caption text-ink-500">
          Stored encrypted. Only this person and whoever manages the team can read it.
        </p>
      </div>
      <Btn type="submit" variant="primary" size="md" disabled={pending}>
        <Spin on={pending} />
        {person ? "Save changes" : "Add person"}
      </Btn>
    </form>
  );
}

export function StatusForm({ brandId, personId, status }: { brandId: string; personId: string; status: "active" | "left" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPersonStatus, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="status" value={status === "active" ? "left" : "active"} />
      <Notes state={state} />
      <Btn type="submit" variant="secondary" size="md" disabled={pending}>
        <Spin on={pending} />
        {status === "active" ? "Mark as left" : "Mark as active again"}
      </Btn>
    </form>
  );
}

export function WorkSettingsForm({ brandId, settings }: { brandId: string; settings: HrSettings }) {
  const [v, setV] = useState({ workStart: settings.workStart, lateAfterMin: String(settings.lateAfterMin), workdays: String(settings.workdays), leaveDays: String(settings.leaveDays) });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((old) => ({ ...old, [k]: e.target.value }));
  const [state, action, pending] = useActionState<FormState, FormData>(saveWorkSettings, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <Notes state={state} />
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <div>
          <label htmlFor="ws-start" className={labelCls}>
            Work starts at
          </label>
          <input id="ws-start" name="workStart" type="time" value={v.workStart} onChange={set("workStart")} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="ws-late" className={labelCls}>
            Late after this many minutes
          </label>
          <input id="ws-late" name="lateAfterMin" inputMode="numeric" value={v.lateAfterMin} onChange={set("lateAfterMin")} maxLength={3} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="ws-days" className={labelCls}>
            Working days
          </label>
          <select id="ws-days" name="workdays" value={v.workdays} onChange={set("workdays")} className={selectCls}>
            {([5, 6, 7] as const).map((d) => (
              <option key={d} value={d}>
                {WORKDAYS_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ws-leave" className={labelCls}>
            Annual leave days a year
          </label>
          <input id="ws-leave" name="leaveDays" inputMode="numeric" value={v.leaveDays} onChange={set("leaveDays")} maxLength={3} required className={inputCls} />
        </div>
      </div>
      <Btn type="submit" variant="secondary" size="md" disabled={pending}>
        <Spin on={pending} />
        Save working hours
      </Btn>
    </form>
  );
}

/** Ask for leave. Someone who manages the team can ask on behalf of anyone; everyone else asks for themself. */
export function LeaveForm({ brandId, people, ownId, today }: { brandId: string; people: { id: string; name: string }[] | null; ownId: string | null; today: string }) {
  const blank = { personId: ownId ?? people?.[0]?.id ?? "", kind: "annual", start: "", end: "", note: "" };
  const [v, setV] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((old) => ({ ...old, [k]: e.target.value }));
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await requestLeave(prev, fd);
    if (r.message) setV((old) => ({ ...blank, personId: old.personId }));
    return r;
  }, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <Notes state={state} />
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        {people ? (
          <div>
            <label htmlFor="lv-person" className={labelCls}>
              Who is it for
            </label>
            <select id="lv-person" name="personId" value={v.personId} onChange={set("personId")} className={selectCls}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === ownId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="lv-kind" className={labelCls}>
            Kind of leave
          </label>
          <select id="lv-kind" name="kind" value={v.kind} onChange={set("kind")} className={selectCls}>
            {LEAVE_KINDS.map((k) => (
              <option key={k} value={k}>
                {LEAVE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lv-start" className={labelCls}>
            First day off
          </label>
          <input id="lv-start" name="start" type="date" value={v.start} onChange={(e) => setV((old) => ({ ...old, start: e.target.value, end: old.end && old.end >= e.target.value ? old.end : e.target.value }))} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="lv-end" className={labelCls}>
            Last day off
          </label>
          <input id="lv-end" name="end" type="date" value={v.end} min={v.start || undefined} onChange={set("end")} required className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="lv-note" className={labelCls}>
          Note (optional)
        </label>
        <textarea id="lv-note" name="note" value={v.note} onChange={set("note")} maxLength={LIMITS.reason} rows={2} className={textareaCls} aria-describedby="lv-note-hint" />
        <p id="lv-note-hint" className="mt-2 text-caption text-ink-500">
          Stored encrypted. Only you and whoever manages the team can read it. {v.start && v.start < today ? "These dates are in the past: that is fine for leave already taken." : ""}
        </p>
      </div>
      <Btn type="submit" variant="primary" size="md" disabled={pending}>
        <Spin on={pending} />
        Ask for leave
      </Btn>
    </form>
  );
}

/** Approve, reject or cancel one request. Only the buttons this person may use are shown. */
export function LeaveButtons({ brandId, leaveId, canDecide, canCancel }: { brandId: string; leaveId: string; canDecide: boolean; canCancel: boolean }) {
  const [decided, decide, deciding] = useActionState<FormState, FormData>(decideLeave, {});
  const [cancelled, cancel, cancelling] = useActionState<FormState, FormData>(cancelLeave, {});
  const busy = deciding || cancelling;
  const error = decided.error ?? cancelled.error;
  if (!canDecide && !canCancel) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {canDecide && (
          <form action={decide} className="flex flex-wrap gap-2">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="leaveId" value={leaveId} />
            <Btn type="submit" name="decision" value="approved" variant="primary" size="sm" disabled={busy}>
              Approve
            </Btn>
            <Btn type="submit" name="decision" value="rejected" variant="secondary" size="sm" disabled={busy}>
              Reject
            </Btn>
          </form>
        )}
        {canCancel && (
          <form action={cancel}>
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="leaveId" value={leaveId} />
            <Btn type="submit" variant="ghost" size="sm" disabled={busy}>
              Cancel this leave
            </Btn>
          </form>
        )}
      </div>
      <p aria-live="polite" className="mt-2 text-caption text-danger">
        {error}
      </p>
    </div>
  );
}
