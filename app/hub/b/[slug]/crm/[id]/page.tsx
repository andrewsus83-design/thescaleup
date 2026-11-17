import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand/primitives";
import { btnCls, cardCls, pillCls } from "@/components/brand/styles";
import { DeletePerson, NoteForm, PersonForm } from "@/components/hub/crm/forms";
import { FollowChip, StageChip, listPath, shortDay, stamp } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { convertToClient, deleteNote, setFollowUp, setStage } from "@/lib/hub/crm-actions";
import { getPerson, getStages, listNotes } from "@/lib/hub/crm/data";
import { maskContacts } from "@/lib/hub/crm/mask";
import { followState, stagesOf } from "@/lib/hub/crm/model";
import { atLeast, canSeeContacts } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { UUID } from "@/lib/hub/tasks/context";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

const H2 = "mb-4 font-title text-h3 text-ink-800";

export default async function PersonPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { user, brand, actor, access } = await requireFunction(slug, "crm");
  if (!UUID.test(id)) notFound();
  const found = await getPerson(brand.id, id);
  if (!found) notFound();
  // Without the "Contact details" permission the person is shown with email and phone hidden. The full values never leave the server.
  const reveal = canSeeContacts(access);
  const person = reveal ? found : maskContacts(found);
  const [notes, stages] = await Promise.all([listNotes(brand.id, id), getStages(brand.id)]);
  const tz = hubTz();
  const today = todayIn(tz);
  const canEdit = atLeast(access.crm, "edit");
  const manager = canManageTeam(actor);
  const state = followState(person, today, stages);
  const kindWord = person.kind === "lead" ? "Lead" : "Client";

  return (
    <>
      <PageHeader
        title={person.name}
        description={[kindWord, person.company, person.source].filter(Boolean).join(" · ")}
        action={
          <Link href={listPath(slug, person.kind)} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            {person.kind === "lead" ? "Leads" : "Clients"}
          </Link>
        }
      />

      <div className="space-y-6">
        <section className={cardCls(true)} aria-labelledby="stage-h">
          <h2 id="stage-h" className={H2}>
            Stage
          </h2>
          {canEdit ? (
            <form action={setStage} className="flex flex-wrap gap-2" aria-label="Move to another stage">
              <input type="hidden" name="brandId" value={brand.id} />
              <input type="hidden" name="id" value={person.id} />
              {stagesOf(stages, person.kind).map((s) => (
                <button key={s.key} type="submit" name="stage" value={s.key} disabled={s.key === person.stage} aria-pressed={s.key === person.stage} className={pillCls(s.key === person.stage)}>
                  {s.label}
                </button>
              ))}
            </form>
          ) : (
            <StageChip stages={stages} stage={person.stage} />
          )}
          {canEdit && person.kind === "lead" && (
            <form action={convertToClient} className="mt-4">
              <input type="hidden" name="brandId" value={brand.id} />
              <input type="hidden" name="id" value={person.id} />
              <button type="submit" className={btnCls("primary", "md")}>
                They bought: make a client
              </button>
              <p className="mt-2 text-small text-ink-500">Moves them to Clients as Active. Their details and notes stay.</p>
            </form>
          )}
          {person.converted_at && <p className="mt-4 text-small text-ink-500">Became a client on {stamp(person.converted_at, tz)}.</p>}
        </section>

        <section className={cardCls(true)} aria-labelledby="follow-h">
          <h2 id="follow-h" className={H2}>
            Follow-up
          </h2>
          {person.next_follow_up ? (
            <p className="mb-4 flex flex-wrap items-center gap-2 text-body text-ink-800">
              Next: <span className="font-semibold">{shortDay(person.next_follow_up)}</span>
              <FollowChip state={state} date={person.next_follow_up} />
            </p>
          ) : (
            <p className="mb-4 text-body text-ink-500">No follow-up is set.</p>
          )}
          {canEdit && (
            <form action={setFollowUp} className="flex flex-wrap gap-2" aria-label="Set the next follow-up">
              <input type="hidden" name="brandId" value={brand.id} />
              <input type="hidden" name="id" value={person.id} />
              <button type="submit" name="days" value="1" className={pillCls(false)}>
                Tomorrow
              </button>
              <button type="submit" name="days" value="3" className={pillCls(false)}>
                In 3 days
              </button>
              <button type="submit" name="days" value="7" className={pillCls(false)}>
                In a week
              </button>
              {person.next_follow_up && (
                <button type="submit" name="clear" value="1" className={pillCls(false)}>
                  <X className="size-4" aria-hidden />
                  Clear
                </button>
              )}
            </form>
          )}
        </section>

        <section className={cardCls()} aria-labelledby="notes-h">
          <h2 id="notes-h" className={H2}>
            Notes
          </h2>
          {canEdit && <NoteForm brandId={brand.id} id={person.id} />}
          {notes.length === 0 ? (
            <p className={`text-body text-ink-500 ${canEdit ? "mt-4" : ""}`}>No notes yet.</p>
          ) : (
            <ul className={`divide-y divide-hairline ${canEdit ? "mt-6" : ""}`}>
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-caption text-ink-500">
                      {n.author_label || "Someone"} · {stamp(n.created_at, tz)}
                    </p>
                    <p className="mt-1 text-body whitespace-pre-wrap text-ink-800 [overflow-wrap:anywhere]">{n.body}</p>
                  </div>
                  {canEdit && (n.author_id === user.id || manager) && (
                    <form action={deleteNote}>
                      <input type="hidden" name="brandId" value={brand.id} />
                      <input type="hidden" name="noteId" value={n.id} />
                      <button type="submit" aria-label="Delete this note" title="Delete this note" className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 hover:text-ink-800">
                        <X className="size-4" aria-hidden />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardCls()} aria-labelledby="details-h">
          <h2 id="details-h" className={H2}>
            Details
          </h2>
          {canEdit ? (
            <PersonForm brandId={brand.id} kind={person.kind} person={person} contactsHidden={!reveal} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["Company", person.company],
                  ["Email", person.email],
                  ["Phone", person.phone],
                  ["Where they came from", person.source],
                  ["Value", person.value === null ? "" : String(person.value)],
                  ["Tags", person.tags.join(", ")],
                  ["About", person.summary],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className={k === "About" ? "sm:col-span-2" : ""}>
                    <dt className="text-caption text-ink-500">{k}</dt>
                    <dd className="mt-0.5 text-body whitespace-pre-wrap text-ink-800 [overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
            </dl>
          )}
        </section>

        {canEdit && manager && <DeletePerson brandId={brand.id} id={person.id} name={person.name} notes={notes.length} />}
      </div>
    </>
  );
}
