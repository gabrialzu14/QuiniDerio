"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import {DERIO_COACH_CHANGE} from "../lib/coach-change";
import {FIRST_COACH_EXPULSION as notice, firstCoachNoticeState} from "../lib/first-coach-expulsion";
import usePageScrollLock from "./usePageScrollLock";
import "./first-coach-expulsion-popup.css";

const OTHER_DIALOG = '[aria-modal="true"],.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay';

export default function FirstCoachExpulsionPopup() {
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);
  const identity = useRef("");
  const opened = useRef(false);
  const busy = useRef("");
  const acknowledged = useRef(new Set<string>());
  const action = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePageScrollLock(open);

  useEffect(() => {
    let active = true, observed = false;
    const sync = (id: string) => {
      if (!active || identity.current === id) return;
      identity.current = id;
      opened.current = false;
      busy.current = "";
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setOpen(false); setLeaving(false); setSaving(false); setError(""); setUserId(id);
    };
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      observed = true;
      sync(session?.user?.id || "");
    });
    void supabase.auth.getSession().then(({data: {session}}) => {
      if (!observed) sync(session?.user?.id || "");
    }).catch(() => {/* The next auth event retries a recovered session. */});
    return () => {active = false; identity.current = ""; subscription.unsubscribe()};
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true, checking = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const blocked = () => document.body.classList.contains("qd-entering") || !!document.querySelector(OTHER_DIALOG);
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      if (active) timer = setTimeout(() => void check(), delay);
    };
    const check = async () => {
      if (!active || checking || opened.current || acknowledged.current.has(userId) || document.hidden) return;
      if (blocked()) {schedule(650); return}
      checking = true;
      try {
        // The server remembers both notices on every device. The coach change is
        // acknowledged only after its second page has been explicitly confirmed.
        const {data, error: readError} = await supabase.from("quini_announcement_acknowledgements")
          .select("announcement_id").eq("user_id", userId)
          .in("announcement_id", [DERIO_COACH_CHANGE.announcementId, notice.announcementId])
          .abortSignal(controller.signal);
        if (!active || identity.current !== userId) return;
        if (readError || !Array.isArray(data)) {schedule(5000); return}
        const state = firstCoachNoticeState(data, DERIO_COACH_CHANGE.announcementId);
        if (state === "seen") {acknowledged.current.add(userId); return}
        if (state === "waiting") {schedule(2500); return}
        // A different dialog may have opened while the request was in flight.
        if (document.hidden || blocked()) {schedule(650); return}
        opened.current = true;
        setLeaving(false); setError(""); setOpen(true);
      } catch {if (active) schedule(5000)} finally {checking = false}
    };
    const resume = () => schedule(350);
    const afterCoach = () => schedule(160);
    const events = ["focus", "online", "quiniderio-david-popup-closed", "quiniderio-suspended-popup-closed"];
    schedule(1300);
    events.forEach(event => window.addEventListener(event, resume));
    window.addEventListener("quiniderio-coach-popup-closed", afterCoach);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false; controller.abort(); if (timer) clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, resume));
      window.removeEventListener("quiniderio-coach-popup-closed", afterCoach);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [userId]);

  const confirm = useCallback(async () => {
    if (!userId || identity.current !== userId || busy.current || acknowledged.current.has(userId)) return;
    busy.current = userId; setSaving(true); setError("");
    try {
      const {data: {user}, error: authError} = await supabase.auth.getUser();
      if (identity.current !== userId) return;
      if (authError || user?.id !== userId) throw new Error("session");
      const {error: saveError} = await supabase.from("quini_announcement_acknowledgements").upsert({
        user_id: userId, announcement_id: notice.announcementId,
      }, {onConflict: "user_id,announcement_id", ignoreDuplicates: true});
      if (identity.current !== userId) return;
      if (saveError) throw saveError;
      acknowledged.current.add(userId);
      setLeaving(true);
      closeTimer.current = setTimeout(() => {
        if (identity.current !== userId) return;
        opened.current = false; setOpen(false);
        window.dispatchEvent(new Event("quiniderio-first-coach-popup-closed"));
        window.dispatchEvent(new Event("quiniderio-suspended-popup-closed"));
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
    } catch {
      if (identity.current === userId) setError("No se ha podido guardar la confirmación. Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      if (busy.current === userId) {busy.current = ""; setSaving(false)}
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    action.current?.focus({preventScroll: true});
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {event.preventDefault(); action.current?.focus({preventScroll: true})}
      if (event.key === "Escape") {event.preventDefault(); void confirm()}
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus({preventScroll: true});
    };
  }, [open, confirm]);
  useEffect(() => () => {if (closeTimer.current) clearTimeout(closeTimer.current)}, []);

  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className={"qdFirstCoachOverlay" + (leaving ? " isLeaving" : "")}>
    <section className="qdFirstCoachModal" role="dialog" aria-modal="true" aria-labelledby="qdFirstCoachTitle" aria-describedby="qdFirstCoachName qdFirstCoachTeam">
      <span className="qdFirstCoachEyebrow">QUINIDERIO</span>
      <h2 id="qdFirstCoachTitle">Primer entrenador<br/>expulsado</h2>
      <div className="qdFirstCoachStage">
        <div className="qdFirstCoachHalo" aria-hidden="true"/>
        <div className="qdFirstCoachPortrait">
          {photoFailed ? <span aria-hidden="true">PG</span> : <img src={notice.photo} alt="Peio Garcia" width="260" height="320" decoding="async" onError={() => setPhotoFailed(true)}/>}
        </div>
        <div className="qdFirstCoachCardAnchor" aria-hidden="true"><div className="qdFirstCoachRedCard"><i/></div></div>
        <span className="qdFirstCoachSpark isOne" aria-hidden="true"/>
        <span className="qdFirstCoachSpark isTwo" aria-hidden="true"/>
        <span className="qdFirstCoachSpark isThree" aria-hidden="true"/>
      </div>
      <div className="qdFirstCoachIdentity">
        <h3 id="qdFirstCoachName">{notice.name}</h3>
        <p id="qdFirstCoachTeam">{notice.team}</p>
      </div>
      {error ? <p className="qdFirstCoachError" role="alert">{error}</p> : null}
      <button ref={action} className="qdFirstCoachAction" type="button" disabled={saving || leaving} onClick={() => void confirm()}>{saving ? "Guardando…" : "Entendido"}</button>
    </section>
  </div>, document.body);
}
