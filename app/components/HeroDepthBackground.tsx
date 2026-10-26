"use client";

import { useEffect, useRef } from "react";

type OrientationAPI = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** Only the decorative stadium moves; the hero's content keeps its own layer. */
export default function HeroDepthBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const activateRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const layer = layerRef.current;
    const button = buttonRef.current;
    const hero = layer?.parentElement;
    if (!layer || !button || !hero) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)");
    const orientation = window.DeviceOrientationEvent as OrientationAPI | undefined;
    let permission: "prompt" | "granted" | "denied" = orientation?.requestPermission ? "prompt" : "granted";
    let disposed = false;
    let visible = true;
    let frame = 0;
    let lastTime = 0;
    let x = 0, y = 0, targetX = 0, targetY = 0;
    let neutral: { beta: number; gamma: number } | null = null;
    let sensorListening = false;
    const clamp = (value: number) => Math.max(-15, Math.min(15, value));
    const active = () => !disposed && !reduced.matches && visible && !document.hidden;

    function paint(time: number) {
      frame = 0;
      if (!active()) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16;
      lastTime = time;
      const blend = 1 - Math.exp(-elapsed / 130);
      x += (targetX - x) * blend;
      y += (targetY - y) * blend;
      if (Math.abs(targetX - x) < 0.01 && Math.abs(targetY - y) < 0.01) {
        x = targetX; y = targetY;
      }
      layer!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (x !== targetX || y !== targetY) frame = requestAnimationFrame(paint);
    }
    function schedule() {
      if (active() && !frame) frame = requestAnimationFrame(paint);
    }
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0; lastTime = 0;
      x = y = targetX = targetY = 0;
      neutral = null;
      layer!.style.transform = "translate3d(0, 0, 0)";
    }
    function onOrientation(event: DeviceOrientationEvent) {
      if (!active() || event.beta === null || event.gamma === null ||
          !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      const { beta, gamma } = event;
      if (!neutral) neutral = { beta, gamma };
      const delta = (value: number) => ((value + 540) % 360) - 180;
      const dx = delta(gamma - neutral.gamma);
      const dy = delta(beta - neutral.beta);
      const angle = (window.screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
      targetX = clamp(-(dx * Math.cos(angle) + dy * Math.sin(angle)) * 0.65);
      targetY = clamp(-(dy * Math.cos(angle) - dx * Math.sin(angle)) * 0.65);
      schedule();
    }
    function sync() {
      reset();
      const useSensor = active() && !desktop.matches && !!orientation && permission === "granted";
      if (useSensor && !sensorListening) window.addEventListener("deviceorientation", onOrientation, { passive: true });
      if (!useSensor && sensorListening) window.removeEventListener("deviceorientation", onOrientation);
      sensorListening = useSensor;
      button!.hidden = !(active() && !desktop.matches && !!orientation?.requestPermission && permission === "prompt");
      layer!.style.willChange = active() ? "transform" : "auto";
    }
    function onPointer(event: PointerEvent) {
      if (!active() || !desktop.matches || event.pointerType !== "mouse") return;
      const rect = hero!.getBoundingClientRect();
      targetX = clamp(-(event.clientX - rect.left - rect.width / 2) / rect.width * 30);
      targetY = clamp(-(event.clientY - rect.top - rect.height / 2) / rect.height * 30);
      schedule();
    }
    function onLeave() { targetX = targetY = 0; schedule(); }
    activateRef.current = async () => {
      if (!orientation?.requestPermission || permission !== "prompt") return;
      button!.disabled = true;
      try { permission = await orientation.requestPermission(); }
      catch { permission = "denied"; }
      if (!disposed) { button!.disabled = false; sync(); }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer?.observe(hero);
    hero.addEventListener("pointermove", onPointer, { passive: true });
    hero.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    window.screen.orientation?.addEventListener("change", reset);
    window.addEventListener("orientationchange", reset);
    sync();
    return () => {
      disposed = true;
      reset();
      observer?.disconnect();
      window.removeEventListener("deviceorientation", onOrientation);
      hero.removeEventListener("pointermove", onPointer);
      hero.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
      window.screen.orientation?.removeEventListener("change", reset);
      window.removeEventListener("orientationchange", reset);
      activateRef.current = async () => {};
    };
  }, []);

  return <>
    <div ref={layerRef} aria-hidden="true" className="qdHeroDepthImage" />
    <button ref={buttonRef} hidden type="button" onClick={() => void activateRef.current()}
      className="qdHeroDepthActivate">
      Activar efecto de profundidad
    </button>
  </>;
}
