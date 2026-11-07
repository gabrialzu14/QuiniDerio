"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import {DERIO_COACH_CHANGE as change} from "../lib/coach-change";
import usePageScrollLock from "./usePageScrollLock";
import "./coach-change-popup.css";

const OTHER_DIALOG = '[aria-modal="true"],.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay';

export default function CoachChangePopup() {
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    }).catch(() => {/* Retry on the next auth event. */});
    return () => {active = false; identity.current = ""; subscription.unsubscribe()};
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true, checking = false, unread = false;
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
        if (!unread) {
          const {data, error: readError} = await supabase.from("quini_announcement_acknowledgements")
            .select("announcement_id").eq("user_id", userId).eq("announcement_id", change.announcementId)
            .abortSignal(controller.signal).maybeSingle();
          if (!active || identity.current !== userId) return;
          if (readError) {schedule(5000); return}
          if (data) {acknowledged.current.add(userId); return}
          unread = true;
        }
        // Recheck after the request: older notices may have opened in the meantime.
        if (document.hidden || blocked()) {schedule(650); return}
        opened.current = true;
        setLeaving(false); setError(""); setOpen(true);
      } catch {if (active) schedule(5000)} finally {checking = false}
    };
    const resume = () => schedule(350);
    const events = ["focus", "online", "quiniderio-david-popup-closed", "quiniderio-suspended-popup-closed"];
    schedule(900);
    events.forEach(event => window.addEventListener(event, resume));
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false; controller.abort(); if (timer) clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, resume));
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
        user_id: userId, announcement_id: change.announcementId,
      }, {onConflict: "user_id,announcement_id", ignoreDuplicates: true});
      if (identity.current !== userId) return;
      if (saveError) throw saveError;
      acknowledged.current.add(userId);
      setLeaving(true);
      closeTimer.current = setTimeout(() => {
        if (identity.current !== userId) return;
        opened.current = false; setOpen(false);
        window.dispatchEvent(new Event("quiniderio-coach-popup-closed"));
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
  return createPortal(<div className={"qdCoachOverlay" + (leaving ? " isLeaving" : "")}>
    <section className="qdCoachModal" role="dialog" aria-modal="true" aria-labelledby="qdCoachTitle" aria-describedby="qdCoachDescription">
      <div className="qdCoachHeading">
        <span className="qdCoachEyebrow"><i aria-hidden="true"/> DERIO A · NUEVA ETAPA</span>
        <h2 id="qdCoachTitle">Cambio de entrenador</h2>
        <p>Aner Blanco toma el relevo de Nando Alonso.</p>
      </div>
      <div className="qdCoachStage" role="group" aria-label="De Nando Alonso a Aner Blanco">
        <article className="qdCoachPortrait qdCoachPrevious">
          <div className="qdCoachPhoto"><img src={change.previousPhoto} alt="Nando Alonso" width="384" height="512" decoding="async"/></div>
          <div className="qdCoachCaption"><small>HASTA AHORA</small><strong>Nando <span>Alonso</span></strong></div>
        </article>
        <div className="qdCoachHandoff" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <article className="qdCoachPortrait qdCoachCurrent">
          <div className="qdCoachPhoto"><img src={change.photo} srcSet={`${change.photo} 384w, ${change.photoLarge} 768w`} sizes="(max-width: 480px) 42vw, 210px" alt="Aner Blanco, nuevo entrenador del Derio A" width="384" height="519" decoding="async" fetchPriority="high"/></div>
          <div className="qdCoachCaption"><small>NUEVO ENTRENADOR</small><strong>Aner <span>Blanco</span></strong></div>
          <span className="qdCoachNew" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        </article>
      </div>
      <div className="qdCoachTransfer">
        <span className="qdCoachTransferIcon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M5 8h14m-4-4 4 4-4 4M19 16H5m4 4-4-4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <div><strong>Tus predicciones siguen en juego</strong><p id="qdCoachDescription">Las predicciones de Nando pasan a ser las de Aner. Se conservan tus elecciones y puntos.</p></div>
      </div>
      {error ? <p className="qdCoachError" role="alert">{error}</p> : null}
      <button ref={action} className="qdCoachAction" type="button" disabled={saving || leaving} onClick={() => void confirm()}>{saving ? "Guardando…" : "Entendido"}</button>
      <p className="qdCoachFootnote">No tienes que hacer ningún cambio.</p>
    </section>
  </div>, document.body);
}
