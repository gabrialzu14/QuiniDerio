"use client";

import {useEffect, useState, type CSSProperties} from "react";
import {supabase} from "../lib/supabase";
import {coachPredictionImpacts, DERIO_COACH_CHANGE as change, type CoachImpactProfile, type CoachPredictionImpact} from "../lib/coach-change";

function PredictionCard({color}: {color: "red" | "yellow"}) {
  return <span className={"qdCoachPredictionCard is-" + color} aria-hidden="true"><svg viewBox="0 0 22 30" width="22" height="30" fill="none"><rect x="2" y="1.5" width="18" height="27" rx="3" fill="currentColor"/><rect x="2.5" y="2" width="17" height="26" rx="2.5" stroke="white" strokeOpacity=".3"/><path d="M5 6h11" stroke="white" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round"/></svg></span>;
}

function ImpactAvatar({person}: {person: CoachPredictionImpact}) {
  const [failed, setFailed] = useState(false);
  return <span className="qdCoachImpactAvatar" aria-hidden="true">
    {person.hasProfilePic && !failed
      ? <img src={`/api/avatar/${encodeURIComponent(person.userId)}`} alt="" width="32" height="32" loading="lazy" onError={() => setFailed(true)}/>
      : person.name.trim().slice(0, 1).toLocaleUpperCase("es")}
  </span>;
}

export default function CoachChangeDetails({userId, onReadyChange}: {userId: string; onReadyChange: (ready: boolean) => void}) {
  const [people, setPeople] = useState<CoachPredictionImpact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true); setError(false); setPeople([]); onReadyChange(false);
    void (async () => {
      try {
        // Reuse the app's public participant view; no private profile fields are read.
        const {data, error: readError} = await supabase.from("quini_public_profiles")
          .select("user_id,username,season,has_profile_pic").abortSignal(controller.signal);
        if (!active) return;
        if (readError || !Array.isArray(data)) throw new Error("participants");
        setPeople(coachPredictionImpacts(data as CoachImpactProfile[]));
        onReadyChange(true);
      } catch {
        if (active) {setError(true); onReadyChange(false)}
      } finally {clearTimeout(timeout); if (active) setLoading(false)}
    })();
    return () => {active = false; clearTimeout(timeout); controller.abort()};
  }, [userId, revision, onReadyChange]);

  return <div className="qdCoachDetails">
    <div className="qdCoachHeading">
      <span className="qdCoachEyebrow"><i aria-hidden="true"/> DERIO A</span>
      <h2 id="qdCoachImpactTitle" tabIndex={-1}>Predicciones actualizadas</h2>
    </div>
    <div className="qdCoachCoachSwap" id="qdCoachImpactDescription" aria-label="Las elecciones de Nando Alonso pasan a Aner Blanco"><span>Nando Alonso</span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg><strong>Aner Blanco</strong></div>
    {loading ? <div className="qdCoachImpactLoading" role="status" aria-label="Cargando participantes afectados">
      {[0, 1, 2].map(index => <div className="qdCoachImpactSkeleton" key={index}><i/><span/><b/></div>)}
      <p>Comprobando las predicciones…</p>
    </div> : error ? <div className="qdCoachImpactLoadError" role="alert">
      <p>No se ha podido cargar la lista de participantes. Comprueba tu conexión y vuelve a intentarlo.</p>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button>
    </div> : <>
      {people.length ? <ul className="qdCoachImpactList" tabIndex={0} aria-label="Participantes y cambios en sus predicciones">
        {people.map((person, index) => <li className={"qdCoachImpactPerson" + (person.userId === userId ? " isYou" : "")} key={person.userId} style={{"--impact-index": index} as CSSProperties}>
          <ImpactAvatar person={person}/>
          <div className="qdCoachImpactPersonCopy"><strong>{person.name}{person.userId === userId ? <small>TÚ</small> : null}</strong><span>{person.changes.map(choice => <span key={choice.field} aria-label={`${choice.label}: antes ${change.previous}, ahora ${change.current}`}>{choice.shortLabel}</span>)}</span></div>
          <div className="qdCoachPredictionCards">{person.changes.map(choice => <PredictionCard key={choice.field} color={choice.cardColor}/>)}</div>
        </li>)}
      </ul> : <p className="qdCoachImpactEmpty">No hay participantes con estas elecciones.</p>}
      <p className="qdCoachImpactNote"><svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><strong>Puntos intactos.</strong></p>
    </>}
  </div>;
}
