"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import usePageScrollLock from "./usePageScrollLock";
import "./ibarlu-wins-popup.css";

/** Shown once per player, the first time they open the Quiniela tab:
 *  Iker Ibarluzea with four wins (the fourth tick lands animated), then a video. */
const ANNOUNCEMENT = "ibarlu-4-victorias-2026-11-v3";
const LOCAL_KEY = "qd-ack-" + ANNOUNCEMENT;
const PHOTO = "/api/assets/entrenadores/IkerIbarluzea.png?opt=4";
const VIDEO = "/videos/ibarlu-4-victorias.mp4";
const OTHER_DIALOG = '[aria-modal="true"]:not(.qdIbarluPopup),.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay';

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
};

export default function IbarluWinsPopup({active}: {active: boolean}) {
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "video">("intro");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false); // sticky: once watched to the end, the X stays
  const [photoFailed, setPhotoFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const checked = useRef("");
  usePageScrollLock(open);

  useEffect(() => {
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id || ""));
    void supabase.auth.getSession().then(({data: {session}}) => setUserId(session?.user?.id || "")).catch(() => {});
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!active || !userId || open || checked.current === userId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {if (localStorage.getItem(LOCAL_KEY) === userId) {checked.current = userId; return}} catch {}
      if (document.querySelector(OTHER_DIALOG) || document.body.classList.contains("qd-entering")) {timer = setTimeout(run, 700); return}
      const {data, error} = await supabase.from("quini_announcement_acknowledgements")
        .select("announcement_id").eq("user_id", userId).eq("announcement_id", ANNOUNCEMENT);
      if (!alive) return;
      checked.current = userId;
      if (error) return;
      if (data && data.length) {try {localStorage.setItem(LOCAL_KEY, userId)} catch {} return}
      setStep("intro"); setEnded(false); setTime(0); setOpen(true);
    };
    timer = setTimeout(run, 250);
    return () => {alive = false; if (timer) clearTimeout(timer)};
  }, [active, userId, open]);

  const start = () => {
    setStep("video");
    // Started from the tap on "Adelante", so the browser allows playing with sound.
    requestAnimationFrame(() => {
      const v = video.current;
      if (!v) return;
      v.muted = false; setMuted(false);
      v.play().catch(() => {v.muted = true; setMuted(true); void v.play().catch(() => {})});
    });
  };

  const close = async () => {
    video.current?.pause();
    setOpen(false);
    try {localStorage.setItem(LOCAL_KEY, userId)} catch {}
    await supabase.from("quini_announcement_acknowledgements")
      .upsert({user_id: userId, announcement_id: ANNOUNCEMENT}, {onConflict: "user_id,announcement_id", ignoreDuplicates: true});
  };

  const toggle = () => {
    const v = video.current; if (!v) return;
    if (v.paused) {if (v.ended) v.currentTime = 0; void v.play()} else v.pause();
  };
  const toggleMute = () => {const v = video.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted)};
  const seek = (value: number) => {const v = video.current; if (!v) return; v.currentTime = value; setTime(value)};

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="qdIbarluBackdrop">
      <section className="qdIbarluPopup" role="dialog" aria-modal="true" aria-label="Iker Ibarluzea, cuatro victorias">
        {step === "intro" ? <div className="qdIbarluIntro">
          <div className="qdIbarluPhoto">{photoFailed ? <span>IKER</span> : <img src={PHOTO} alt="Iker Ibarluzea" onError={() => setPhotoFailed(true)}/>}</div>
          <h2>Iker Ibarluzea</h2>
          <div className="qdIbarluTicks" aria-label="4 victorias seguidas">
            {[0, 1, 2, 3].map(i => <span key={i} className={"qdIbarluTick" + (i === 3 ? " isNew" : "")} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            </span>)}
          </div>
          <p className="qdIbarluCaption"><b>4 victorias consecutivas</b> con el Derio Fem</p>
          <p className="qdIbarluMoment">Y esto merece su momento</p>
          <button type="button" className="qdIbarluNext" onClick={start}>Adelante</button>
        </div> : <div className="qdIbarluVideo">
          {ended && <button type="button" className="qdIbarluClose" aria-label="Cerrar" onClick={() => void close()}>×</button>}
          <video ref={video} src={VIDEO} poster="/videos/ibarlu-4-victorias.jpg" playsInline preload="auto"
            onClick={toggle}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onEnded={() => {setPlaying(false); setEnded(true)}}
            onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={e => setDuration(e.currentTarget.duration)}/>
          <div className="qdIbarluControls">
            <button type="button" onClick={toggle} aria-label={playing ? "Pausa" : "Reproducir"}>
              {playing ? <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </button>
            <input type="range" min={0} max={duration || 0} step={0.1} value={time} aria-label="Avanzar o retroceder"
              onChange={e => seek(Number(e.target.value))}
              style={{"--p": (duration ? time / duration * 100 : 0) + "%"} as React.CSSProperties}/>
            <span className="qdIbarluTime">{fmt(time)} / {fmt(duration)}</span>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"}>
              {muted ? <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
            </button>
          </div>
        </div>}
      </section>
    </div>, document.body);
}
