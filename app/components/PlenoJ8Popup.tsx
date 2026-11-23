"use client";

import {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import usePageScrollLock from "./usePageScrollLock";
import "./pleno-j8-popup.css";

/** Shown once per player: Julen and Balbuena scored 7/7 in round 8, and each has 3 € taken off the pot. */
const ANNOUNCEMENT = "plenos-j8-2026-11";
const LOCAL_KEY = "qd-ack-" + ANNOUNCEMENT;
const OTHER_DIALOG = '[aria-modal="true"]:not(.qdPlenoPopup),.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay';
const PLAYERS = [
  {name: "Julen", photo: "/plenos/julen-j8.jpg"},
  {name: "Balbuena", photo: "/plenos/balbuena-j8.jpg"},
];
const READY_MS = 6400; // the button appears when the animation ends

const Crown = () => <svg className="qdPlenoCrown" viewBox="0 0 48 36" aria-hidden="true"><path d="M3 30 L7 8 L17 20 L24 4 L31 20 L41 8 L45 30 Z" fill="#fbbf24" stroke="#fff3b0" strokeWidth="2"/></svg>;

export default function PlenoJ8Popup() {
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  usePageScrollLock(open);

  useEffect(() => {
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id || ""));
    void supabase.auth.getSession().then(({data: {session}}) => setUserId(session?.user?.id || "")).catch(() => {});
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || open) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (!alive) return;
      try {if (localStorage.getItem(LOCAL_KEY) === userId) return} catch {}
      // Wait for the splash, notices and any other dialog (coach change, push prompt, videos...) to finish.
      if (document.hidden || document.body.classList.contains("qd-entering") || document.querySelector(OTHER_DIALOG)) {timer = setTimeout(run, 900); return}
      const {data, error} = await supabase.from("quini_announcement_acknowledgements")
        .select("announcement_id").eq("user_id", userId).eq("announcement_id", ANNOUNCEMENT);
      if (!alive) return;
      if (error) {timer = setTimeout(run, 6000); return}
      if (data && data.length) {try {localStorage.setItem(LOCAL_KEY, userId)} catch {} return}
      if (document.querySelector(OTHER_DIALOG)) {timer = setTimeout(run, 900); return}
      setReady(false); setOpen(true);
    };
    timer = setTimeout(run, 1200);
    return () => {alive = false; if (timer) clearTimeout(timer)};
  }, [userId, open]);

  useEffect(() => {
    if (!open) return;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {setReady(true); return}
    const t = setTimeout(() => setReady(true), READY_MS);
    return () => clearTimeout(t);
  }, [open]);

  const close = async () => {
    setOpen(false);
    try {localStorage.setItem(LOCAL_KEY, userId)} catch {}
    await supabase.from("quini_announcement_acknowledgements")
      .upsert({user_id: userId, announcement_id: ANNOUNCEMENT}, {onConflict: "user_id,announcement_id", ignoreDuplicates: true});
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="qdPlenoBackdrop">
      <section className="qdPlenoPopup" role="dialog" aria-modal="true" aria-labelledby="qdPlenoTitle">
        <div className="qdPlenoRays" aria-hidden="true"/>
        <div className="qdPlenoConfetti" aria-hidden="true">
          {Array.from({length: 46}, (_, i) => <i key={i} style={{
            "--x": ((i * 37) % 100) + "%", "--t": (2.2 + (i * 13 % 16) / 10) + "s", "--d": (4 + (i * 7 % 9) / 10) + "s",
            "--c": ["#fbbf24", "#fde68a", "#22c55e", "#ffffff"][i % 4],
          } as React.CSSProperties}/>)}
        </div>
        <h2 id="qdPlenoTitle" className="qdPlenoTitle">¡DOBLE PLENO!</h2>
        <p className="qdPlenoSay">Aunque parezca increíble, estos dos han hecho pleno<small>JORNADA 8</small></p>
        <div className="qdPlenoPlayers">
          {PLAYERS.map((p, i) => <div key={p.name} className={"qdPlenoPlayer p" + i}>
            <Crown/>
            <div className="qdPlenoPhoto"><img src={p.photo} alt={p.name} width={130} height={130}/></div>
            <b>{p.name}</b>
            <span className="qdPlenoScore">7 / 7</span>
          </div>)}
        </div>
        <div className="qdPlenoPot">
          <em>BOTE ACUMULADO</em>
          <strong>−3 €</strong>
          <span>Ambos jugadores se restan 3 € del Bote acumulado.</span>
        </div>
        <button type="button" className={"qdPlenoBtn" + (ready ? " isReady" : "")} onClick={() => void close()} disabled={!ready}>Entendido</button>
      </section>
    </div>, document.body);
}
