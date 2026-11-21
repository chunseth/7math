"use client";
import { useEffect, useState } from "react";
import type { ConceptAssignment } from "../../lib/database.types";
import { branches, concepts, conceptById } from "../../lib/curriculum/catalog";
import { isPlayable } from "../../lib/curriculum/templates";
import { teacherSupabase as supabase } from "../../lib/supabase";

export default function ConceptAssignments({ students, teacherId }: { students: { id: string; display_name: string; username: string }[]; teacherId: string }) {
  const [studentId, setStudentId] = useState("");
  const [branch, setBranch] = useState("number");
  const [conceptId, setConceptId] = useState("number.integer-add");
  const [assignments, setAssignments] = useState<ConceptAssignment[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setAssignments([]); setReady(false); setMessage("");
    if (!supabase || !studentId) return;
    void supabase.from("concept_assignments").select().eq("profile_id",studentId).order("created_at").then(({ data,error }) => {
      if (cancelled) return;
      if (error) setMessage("Assignments are unavailable. Check that the curriculum migration has been applied.");
      else { setAssignments(data ?? []); setReady(true); }
    });
    return () => { cancelled = true; };
  }, [studentId,revision]);
  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !studentId || busy || !ready) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("concept_assignments").insert({profile_id:studentId,concept_id:conceptId,teacher_id:teacherId});
    if (error) setMessage(error.code === "23505" ? "That concept is already assigned." : "Could not save the assignment. Please retry.");
    else setRevision((value) => value+1);
    setBusy(false);
  }
  async function remove(id: string) {
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    const { error, data } = await supabase.from("concept_assignments").delete().eq("id",id).select("id");
    if (error || !data?.length) setMessage("Could not remove the assignment. Please retry.");
    else setRevision((value) => value+1);
    setBusy(false);
  }
  const concept = conceptById.get(conceptId);
  return <section className="teacher-panel curriculum-assignments" aria-labelledby="assignments-heading">
    <h2 id="assignments-heading">Skill assignments</h2>
    <p>Assign any concept independently of its suggested preparation. Six concepts have numeric practice; other assignments are preparation for future missions.</p>
    <form onSubmit={assign} className="curriculum-controls">
      <label>Student<select disabled={busy} value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Choose a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.display_name || student.username}</option>)}</select></label>
      <label>Branch<select disabled={busy} value={branch} onChange={(e) => { const next=e.target.value;setBranch(next);setConceptId(concepts.find((n) => n.branch===next)!.id); }}>{branches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
      <label>Concept<select disabled={busy} value={conceptId} onChange={(e) => setConceptId(e.target.value)}>{concepts.filter((n) => n.branch===branch).map((n) => <option key={n.id} value={n.id}>{n.title}{isPlayable(n.id) ? " · Practice available" : " · Planned"}</option>)}</select></label>
      <button disabled={!studentId || !ready || busy || assignments.some((a) => a.concept_id===conceptId)} type="submit">{busy ? "Saving…" : "Assign skill"}</button>
    </form>
    <p>Suggested preparation: {concept?.prerequisites.map((id) => conceptById.get(id)?.title).join(", ") || "None"}. Assignment bypasses these recommendations.</p>
    {message && <p role="alert">{message}</p>}
    {ready && assignments.length===0 && <p>No skills assigned to this student.</p>}
    <ul>{assignments.map((a) => <li key={a.id}>{conceptById.get(a.concept_id)?.title ?? a.concept_id} · {isPlayable(a.concept_id) ? "Practice available" : "Planned"} {a.teacher_id===teacherId && <button type="button" disabled={busy} onClick={() => void remove(a.id)}>Remove</button>}</li>)}</ul>
  </section>;
}
