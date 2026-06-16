"use client";

import { useEffect, useState } from "react";
import {
  CHANNEL_LABELS,
  TIER_LIMITS,
  canUseChannel,
  type Channel,
  type Tier,
} from "@/lib/tiers";

const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];
type Mode = "single" | "autopilot";

interface ScheduledPost {
  hook: string;
  angle: string;
  content: string;
  scheduledFor: string;
}

function todayKey() {
  return `automate:gen:${new Date().toISOString().slice(0, 10)}`;
}

export default function Home() {
  const [tier, setTier] = useState<Tier>("free");
  const [mode, setMode] = useState<Mode>("single");
  const [topic, setTopic] = useState("");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [count, setCount] = useState(3);

  const [result, setResult] = useState("");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [error, setError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usedToday, setUsedToday] = useState(0);

  useEffect(() => {
    setUsedToday(Number(localStorage.getItem(todayKey()) ?? 0));
  }, []);

  const limit = TIER_LIMITS[tier].dailyGenerations;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - usedToday);
  const outOfQuota = tier === "free" && remaining <= 0;

  function reset() {
    setError("");
    setShowUpgrade(false);
    setResult("");
    setPosts([]);
  }

  async function handleSingle() {
    reset();
    if (!topic.trim()) return setError("주제를 입력해주세요.");
    if (outOfQuota) {
      setShowUpgrade(true);
      return setError(`오늘 무료 생성 ${limit}건을 모두 사용했어요.`);
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, channel, tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "생성에 실패했습니다.");
        if (data.upgrade) setShowUpgrade(true);
        return;
      }
      setResult(data.content);
      if (tier === "free") {
        const next = usedToday + 1;
        setUsedToday(next);
        localStorage.setItem(todayKey(), String(next));
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutopilot() {
    reset();
    if (tier !== "pro") {
      setShowUpgrade(true);
      return setError("자동 운영(Auto-Pilot)은 Pro 전용 기능입니다.");
    }
    if (!topic.trim()) return setError("주제를 입력해주세요.");
    setLoading(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, channel, count, tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "자동 운영 실행에 실패했습니다.");
        if (data.upgrade) setShowUpgrade(true);
        return;
      }
      setPosts(data.posts);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const run = mode === "single" ? handleSingle : handleAutopilot;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      {/* 헤더 + 티어 토글 */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AutoMate</h1>
          <p className="text-sm text-neutral-400">주제만 던지면, 콘텐츠가 알아서.</p>
        </div>
        <div className="flex rounded-full border border-neutral-700 p-1 text-sm">
          {(["free", "pro"] as Tier[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTier(t);
                reset();
              }}
              className={`rounded-full px-4 py-1 capitalize transition ${
                tier === t ? "bg-white text-neutral-900" : "text-neutral-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* 모드 탭 */}
      <div className="mb-5 flex gap-2 text-sm">
        <button
          onClick={() => {
            setMode("single");
            reset();
          }}
          className={`rounded-lg px-3 py-2 transition ${
            mode === "single" ? "bg-neutral-800" : "text-neutral-400"
          }`}
        >
          단건 생성
        </button>
        <button
          onClick={() => {
            setMode("autopilot");
            reset();
          }}
          className={`rounded-lg px-3 py-2 transition ${
            mode === "autopilot" ? "bg-neutral-800" : "text-neutral-400"
          }`}
        >
          ⚡ 자동 운영 (Auto-Pilot)
          {tier !== "pro" && " 🔒"}
        </button>
      </div>

      {/* 입력 */}
      <section className="space-y-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예) 자취생을 위한 5분 아침 루틴"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 outline-none focus:border-neutral-400"
        />

        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => {
            const locked = !canUseChannel(tier, c);
            return (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  channel === c
                    ? "border-white bg-white text-neutral-900"
                    : "border-neutral-700 text-neutral-300"
                } ${locked ? "opacity-50" : ""}`}
                title={locked ? "Pro 전용" : ""}
              >
                {CHANNEL_LABELS[c]}
                {locked && " 🔒"}
              </button>
            );
          })}
        </div>

        {mode === "autopilot" && (
          <label className="flex items-center gap-3 text-sm text-neutral-300">
            며칠치 콘텐츠를 자동 생성할까요?
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}일치
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-xl bg-indigo-500 py-3 font-semibold transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {loading
            ? mode === "autopilot"
              ? "AI가 기획·작성·예약 중…"
              : "생성 중…"
            : mode === "autopilot"
              ? "⚡ 자동으로 굴리기"
              : "콘텐츠 자동 생성"}
        </button>

        {mode === "single" && (
          <p className="text-center text-xs text-neutral-500">
            {tier === "free"
              ? `오늘 ${usedToday}/${limit}건 사용 · 남은 ${remaining}건`
              : "Pro · 무제한 생성"}
          </p>
        )}
      </section>

      {/* 에러 / 업그레이드 유도 */}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {showUpgrade && (
        <div className="mt-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4">
          <p className="font-medium">Pro로 업그레이드하면</p>
          <ul className="mt-2 list-inside list-disc text-sm text-neutral-300">
            <li>⚡ 자동 운영 — 주제 하나로 며칠치 콘텐츠 자동 생성·예약</li>
            <li>무제한 생성 · 멀티 채널 (블로그·X·스레드)</li>
            <li>브랜드 보이스 고정</li>
          </ul>
          <button
            onClick={() => alert("결제 연동 예정 (Stripe)")}
            className="mt-3 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold"
          >
            Pro 시작하기
          </button>
        </div>
      )}

      {/* 단건 결과 */}
      {result && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-400">생성 결과</h2>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="text-sm text-indigo-400 hover:underline"
            >
              복사
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm leading-relaxed">
            {result}
          </pre>
        </section>
      )}

      {/* 자동 운영 결과 — 예약 콘텐츠 큐 */}
      {posts.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-neutral-400">
            📅 자동 생성·예약된 콘텐츠 ({posts.length}건)
          </h2>
          <div className="space-y-3">
            {posts.map((p, i) => (
              <article
                key={i}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                    {p.scheduledFor} 예약됨
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(p.content)}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    복사
                  </button>
                </div>
                <p className="mb-1 text-sm font-semibold">{p.hook}</p>
                <p className="mb-2 text-xs text-neutral-500">{p.angle}</p>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                  {p.content}
                </pre>
              </article>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-neutral-500">
            * 예약 발행은 데모(시뮬레이션)입니다. 실제 채널 자동 발행은 다음 단계에서 연동됩니다.
          </p>
        </section>
      )}
    </main>
  );
}
