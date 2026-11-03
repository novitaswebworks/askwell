"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  APP_NAME,
  DEFAULT_WIDGET_CONFIG,
  type WidgetAnimation,
  type WidgetConfig,
  type WidgetPosition,
} from "@askwell/shared";
import { readableTextColor } from "@/lib/widget-config";

const COLOR_PRESETS = [
  "#000000",
  "#e8590c",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#e11d48",
  "#0f766e",
  "#475569",
];

const POSITIONS: { value: WidgetPosition; label: string }[] = [
  { value: "bottom-right", label: "Bottom right (default)" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

const ANIMATIONS: { value: WidgetAnimation; label: string }[] = [
  { value: "fade", label: "Fade (default)" },
  { value: "slide", label: "Slide" },
  { value: "scale", label: "Scale" },
];

const buttonStyles =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-50";

export function CustomizeManager({
  projectId,
  initialConfig,
  canCustomize,
}: {
  projectId: string;
  initialConfig: WidgetConfig;
  canCustomize: boolean;
}) {
  const [config, setConfig] = useState<WidgetConfig>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const changed =
    config.buttonColor !== initialConfig.buttonColor ||
    config.position !== initialConfig.position ||
    config.label !== initialConfig.label ||
    config.animation !== initialConfig.animation ||
    config.headerText !== initialConfig.headerText ||
    config.showBadge !== initialConfig.showBadge ||
    config.welcomeMessage !== initialConfig.welcomeMessage ||
    JSON.stringify(config.starterQuestions) !== JSON.stringify(initialConfig.starterQuestions) ||
    config.greetingEnabled !== initialConfig.greetingEnabled ||
    config.greetingText !== initialConfig.greetingText;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canCustomize) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage({
          kind: "error",
          text: body?.error?.message ?? "Could not save settings. Try again.",
        });
        return;
      }
      const updated = (await res.json()) as WidgetConfig;
      setConfig(updated);
      setMessage({
        kind: "ok",
        text: "Saved. Changes can take up to about ten minutes to reach your website.",
      });
    } catch {
      setMessage({ kind: "error", text: "Network error. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const textColor = readableTextColor(config.buttonColor);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Settings Form */}
      <form onSubmit={save} className="glass flex flex-col gap-5 p-5 lg:col-span-7">
        {!canCustomize && (
          <div className="flex flex-col gap-2 rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-brand">Customization is a Pro feature</p>
              <p className="text-xs text-muted">
                Upgrade to change your widget&apos;s colors, position, animation, and remove the branding.
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className={`${buttonStyles} shrink-0 bg-brand text-brand-foreground hover:opacity-90`}
            >
              Upgrade to Pro
            </Link>
          </div>
        )}

        {/* Button Color */}
        <div className="space-y-2">
          <label htmlFor="button-color" className="block text-sm font-medium">
            Button color
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex items-center">
              <input
                id="button-color"
                type="color"
                value={config.buttonColor}
                onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                disabled={!canCustomize || busy}
                className="h-10 w-10 cursor-pointer rounded-xl border border-border bg-transparent p-1 disabled:cursor-not-allowed"
                aria-label="Pick button color"
              />
            </div>
            <input
              type="text"
              value={config.buttonColor}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                  setConfig({ ...config, buttonColor: val });
                }
              }}
              maxLength={7}
              placeholder="#000000"
              disabled={!canCustomize || busy}
              className="h-10 w-28 rounded-xl border border-border bg-glass-strong px-3 font-mono text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setConfig({ ...config, buttonColor: color })}
                  disabled={!canCustomize || busy}
                  className="h-7 w-7 rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Button Label */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="label" className="text-sm font-medium">
              Button label
            </label>
            <span className="text-xs text-muted">{config.label.length} of 40</span>
          </div>
          <input
            id="label"
            type="text"
            value={config.label}
            onChange={(e) => setConfig({ ...config, label: e.target.value })}
            maxLength={40}
            disabled={!canCustomize || busy}
            className="h-11 w-full rounded-2xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Position */}
        <div className="space-y-1.5">
          <label htmlFor="position" className="text-sm font-medium">
            Position on page
          </label>
          <select
            id="position"
            value={config.position}
            onChange={(e) => setConfig({ ...config, position: e.target.value as WidgetPosition })}
            disabled={!canCustomize || busy}
            className="h-11 w-full rounded-2xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {POSITIONS.map((pos) => (
              <option key={pos.value} value={pos.value}>
                {pos.label}
              </option>
            ))}
          </select>
        </div>

        {/* Animation */}
        <div className="space-y-1.5">
          <label htmlFor="animation" className="text-sm font-medium">
            Open animation
          </label>
          <select
            id="animation"
            value={config.animation}
            onChange={(e) => setConfig({ ...config, animation: e.target.value as WidgetAnimation })}
            disabled={!canCustomize || busy}
            className="h-11 w-full rounded-2xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {ANIMATIONS.map((anim) => (
              <option key={anim.value} value={anim.value}>
                {anim.label}
              </option>
            ))}
          </select>
        </div>

        {/* Header Text */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="header-text" className="text-sm font-medium">
              Panel header text
            </label>
            <span className="text-xs text-muted">{config.headerText.length} of 60</span>
          </div>
          <input
            id="header-text"
            type="text"
            value={config.headerText}
            onChange={(e) => setConfig({ ...config, headerText: e.target.value })}
            maxLength={60}
            disabled={!canCustomize || busy}
            className="h-11 w-full rounded-2xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Welcome Message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="welcome-message" className="text-sm font-medium">
              Welcome message
            </label>
            <span className="text-xs text-muted">{(config.welcomeMessage ?? "").length} of 200</span>
          </div>
          <input
            id="welcome-message"
            type="text"
            value={config.welcomeMessage ?? ""}
            onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
            maxLength={200}
            disabled={!canCustomize || busy}
            className="h-11 w-full rounded-2xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Greeting bubble */}
        <div className="space-y-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={config.greetingEnabled}
              onChange={(e) => setConfig({ ...config, greetingEnabled: e.target.checked })}
              disabled={!canCustomize || busy}
              className="mt-1 h-4 w-4 accent-foreground"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">Greeting bubble</span>
              <span className="text-xs text-muted">
                A short line pops up beside the chat button a few seconds after a new visitor arrives, once per visitor.
                It remembers that with one small flag in their browser (no personal data).
              </span>
            </span>
          </label>
          {config.greetingEnabled && (
            <div className="space-y-1.5 pl-7">
              <div className="flex items-center justify-between">
                <label htmlFor="greeting-text" className="text-xs font-medium text-muted">
                  Greeting text
                </label>
                <span className="text-xs text-muted">{config.greetingText.length} of 120</span>
              </div>
              <input
                id="greeting-text"
                type="text"
                value={config.greetingText}
                onChange={(e) => setConfig({ ...config, greetingText: e.target.value })}
                maxLength={120}
                disabled={!canCustomize || busy}
                className="h-11 w-full rounded-2xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* Starter Questions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Starter questions</label>
            <span className="text-xs text-muted">{(config.starterQuestions ?? []).length} of 4</span>
          </div>
          <div className="space-y-2">
            {(config.starterQuestions ?? []).map((sq, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={sq}
                  maxLength={100}
                  disabled={!canCustomize || busy}
                  onChange={(e) => {
                    const next = [...(config.starterQuestions ?? [])];
                    next[idx] = e.target.value;
                    setConfig({ ...config, starterQuestions: next });
                  }}
                  className="h-10 flex-1 rounded-xl border border-border bg-glass-strong px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  placeholder={`Question ${idx + 1}`}
                />
                {canCustomize && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = (config.starterQuestions ?? []).filter((_, i) => i !== idx);
                      setConfig({ ...config, starterQuestions: next });
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-glass text-muted hover:bg-glass-strong hover:text-foreground"
                    aria-label="Remove question"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {canCustomize && (config.starterQuestions ?? []).length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    starterQuestions: [...(config.starterQuestions ?? []), ""],
                  })
                }
                className="text-xs font-medium text-brand hover:underline"
              >
                + Add starter question
              </button>
            )}
          </div>
        </div>

        {/* Badge Toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-glass-strong p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Show &quot;Powered by {APP_NAME}&quot; badge</p>
            <p className="text-xs text-muted">
              {canCustomize
                ? "Turn off to hide the branding in your chat panel."
                : "Free plan always displays the badge. Upgrade to remove."}
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={canCustomize ? config.showBadge : true}
              onChange={(e) => canCustomize && setConfig({ ...config, showBadge: e.target.checked })}
              disabled={!canCustomize || busy}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!canCustomize || busy || !changed}
            className={`${buttonStyles} bg-accent text-accent-foreground hover:opacity-90`}
          >
            {busy ? "Saving..." : "Save changes"}
          </button>
          {changed && canCustomize && (
            <button
              type="button"
              onClick={() => setConfig(initialConfig)}
              disabled={busy}
              className={`${buttonStyles} glass text-muted hover:text-foreground`}
            >
              Reset
            </button>
          )}
          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={`text-sm ${message.kind === "error" ? "text-red-700" : "text-muted"}`}
            >
              {message.text}
            </p>
          )}
        </div>
      </form>

      {/* Live Preview Panel */}
      <div className="flex flex-col gap-2 lg:col-span-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Live preview</h2>
          <span className="text-xs text-muted">Click widget to test</span>
        </div>

        <div className="glass relative flex h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-transparent to-black/[0.02]">
          {/* Mock Browser Header */}
          <div className="flex items-center gap-1.5 border-b border-border bg-glass-strong px-3 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <div className="ml-2 h-4 w-32 rounded bg-border/50 text-[10px] text-muted flex items-center px-1.5">
              yourwebsite.com
            </div>
          </div>

          {/* Simulated Page Content */}
          <div className="relative flex-1 p-6">
            <div className="space-y-3 opacity-40">
              <div className="h-4 w-3/4 rounded bg-border" />
              <div className="h-3 w-full rounded bg-border" />
              <div className="h-3 w-5/6 rounded bg-border" />
              <div className="h-3 w-2/3 rounded bg-border" />
            </div>

            {/* Greeting bubble, as a visitor sees it beside the button */}
            {config.greetingEnabled && !previewOpen && (
              <div
                className={`absolute max-w-[14rem] rounded-2xl border border-border bg-background px-3 py-2 text-xs shadow-lg ${
                  config.position.startsWith("bottom") ? "bottom-16" : "top-16"
                } ${config.position.endsWith("right") ? "right-4" : "left-4"}`}
              >
                {config.greetingText || DEFAULT_WIDGET_CONFIG.greetingText}
              </div>
            )}

            {/* Corner Button */}
            <div
              className={`absolute p-4 ${
                config.position === "bottom-right"
                  ? "bottom-0 right-0"
                  : config.position === "bottom-left"
                    ? "bottom-0 left-0"
                    : config.position === "top-right"
                      ? "top-0 right-0"
                      : "top-0 left-0"
              }`}
            >
              <button
                type="button"
                onClick={() => setPreviewOpen(!previewOpen)}
                style={{ backgroundColor: config.buttonColor, color: textColor }}
                className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium shadow-lg transition-transform hover:scale-105"
              >
                <span>{config.label || DEFAULT_WIDGET_CONFIG.label}</span>
              </button>
            </div>

            {/* Simulated Chat Panel */}
            {previewOpen && (
              <div
                className={`absolute z-10 flex w-72 flex-col rounded-2xl border border-border bg-background shadow-2xl transition-all duration-200 ${
                  config.animation === "scale"
                    ? "scale-100"
                    : config.animation === "slide"
                      ? "translate-y-0"
                      : "opacity-100"
                } ${
                  config.position.startsWith("bottom")
                    ? "bottom-16"
                    : "top-16"
                } ${
                  config.position.endsWith("right")
                    ? "right-4"
                    : "left-4"
                }`}
                style={{ height: "340px" }}
              >
                <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                  <span className="truncate text-xs font-semibold">
                    {config.headerText || DEFAULT_WIDGET_CONFIG.headerText}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    aria-label="Close preview panel"
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-glass-strong text-muted"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  <p className="rounded-xl bg-glass p-2 text-xs text-muted">
                    {config.welcomeMessage || DEFAULT_WIDGET_CONFIG.welcomeMessage}
                  </p>
                  {(config.starterQuestions ?? []).length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      {(config.starterQuestions ?? []).map((q, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-border bg-glass-strong px-2.5 py-1.5 text-[11px] text-foreground/80"
                        >
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border p-2">
                  <div className="h-8 rounded-full border border-border bg-glass-strong px-3 text-xs text-muted flex items-center">
                    Type your message...
                  </div>
                </div>

                {(canCustomize ? config.showBadge : true) && (
                  <p className="pb-1.5 text-center text-[10px] text-muted">
                    Powered by {APP_NAME}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
