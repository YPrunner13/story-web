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

function todayKey() {
  return `automate:gen:${new Date().toISOString().slice(0, 10)}`;
}

export default function Home() {
  const [tier, setTier] = useState<Tier>("free");
  const [topic, setTopic] = useState("");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [result, setResult] = useState("");
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

  async function handleGenerate() {
    setError("");
    setShowUpgrade(false);
    setResult("");

    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    if (outOfQuota) {
      setShowUpgrade(true);
      setError(`오늘 무료 생성 ${limit}건을 모두 사용했어요.`);
      return;
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      {/* 헤더 + 티어 토글 */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AutoMate</h1>
          <p className="text-sm text-neutral-400">주제만 던지면, 콘텐츠가 알아서.</p>
        </div>
        <div className="flex rounded-full border border-neutral-700 p-1 text-sm">
          {(["free", "pro"] as Tier[]).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`rounded-full px-4 py-1 capitalize transition ${
                tier === t ? "bg-white text-neutral-900" : "text-neutral-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

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

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-xl bg-indigo-500 py-3 font-semibold transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {loading ? "생성 중…" : "콘텐츠 자동 생성"}
        </button>

        <p className="text-center text-xs text-neutral-500">
          {tier === "free"
            ? `오늘 ${usedToday}/${limit}건 사용 · 남은 ${remaining}건`
            : "Pro · 무제한 생성"}
        </p>
      </section>

      {/* 에러 / 업그레이드 유도 */}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {showUpgrade && (
        <div className="mt-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4">
          <p className="font-medium">Pro로 업그레이드하면</p>
          <ul className="mt-2 list-inside list-disc text-sm text-neutral-300">
            <li>무제한 생성</li>
            <li>멀티 채널 (블로그·X·스레드)</li>
            <li>예약 발행 · 브랜드 보이스</li>
          </ul>
          <button
            onClick={() => alert("결제 연동 예정 (Stripe)")}
            className="mt-3 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold"
          >
            Pro 시작하기
          </button>
        </div>
      )}

      {/* 결과 */}
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
    </main>
  );
}
