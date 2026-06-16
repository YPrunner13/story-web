"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Mood = "calm" | "energetic" | "serious" | "playful" | "inspiring";

interface Scene {
  narration: string;
  onScreenText: string;
  visual: string;
  mood: Mood;
}

interface Storyboard {
  title: string;
  hook: string;
  scenes: Scene[];
}

const MOOD_BG: Record<Mood, string> = {
  calm: "linear-gradient(135deg,#0ea5e9,#4f46e5)",
  energetic: "linear-gradient(135deg,#f97316,#db2777)",
  serious: "linear-gradient(135deg,#334155,#0f172a)",
  playful: "linear-gradient(135deg,#d946ef,#06b6d4)",
  inspiring: "linear-gradient(135deg,#7c3aed,#f59e0b)",
};

/** 나레이션 길이로 장면 길이(초) 추정 — 한국어 약 5자/초 */
function estimateDuration(narration: string): number {
  return Math.max(2.5, Math.round(narration.length / 5));
}

export default function Studio() {
  const [topic, setTopic] = useState("");
  const [length, setLength] = useState<"short" | "normal">("short");
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 한국어 음성 준비
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => v.lang.startsWith("ko")) ?? voices[0] ?? null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => {
      window.speechSynthesis.cancel();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function stopPlayback() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  // 장면 i를 재생: 나레이션 음성 + 끝나면 다음 장면
  function playScene(scenes: Scene[], i: number) {
    if (i >= scenes.length) {
      setPlaying(false);
      setDone(true);
      return;
    }
    setCurrent(i);
    setDone(false);
    setPlaying(true);

    const scene = scenes[i];
    const advance = () => playScene(scenes, i + 1);

    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (synth && scene.narration) {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(scene.narration);
      u.lang = "ko-KR";
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 1.05;
      u.onend = advance;
      // 음성 실패 대비 안전 타이머
      timerRef.current = setTimeout(advance, (estimateDuration(scene.narration) + 2) * 1000);
      u.onstart = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, (estimateDuration(scene.narration) + 4) * 1000);
      };
      synth.speak(u);
    } else {
      timerRef.current = setTimeout(advance, estimateDuration(scene.narration) * 1000);
    }
  }

  async function generate() {
    stopPlayback();
    setError("");
    setBoard(null);
    setDone(false);
    setCurrent(0);
    if (!topic.trim()) return setError("주제를 입력해주세요.");
    setLoading(true);
    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, length }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "생성에 실패했습니다.");
      setBoard(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handlePlay() {
    if (!board) return;
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (playing) {
      synth?.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
      setPlaying(false);
      return;
    }
    // 일시정지 후 재개
    if (synth?.paused && !done) {
      synth.resume();
      setPlaying(true);
      return;
    }
    // 처음부터 / 다시
    stopPlayback();
    playScene(board.scenes, done ? 0 : current);
  }

  function handleRestart() {
    if (!board) return;
    stopPlayback();
    playScene(board.scenes, 0);
  }

  const scene = board?.scenes[current];
  const progress = board ? ((current + 1) / board.scenes.length) * 100 : 0;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎬 AutoMate Studio</h1>
          <p className="text-sm text-neutral-400">
            주제만 넣으면, 나레이션 애니메이션 영상이 자동으로.
          </p>
        </div>
        <Link href="/" className="text-sm text-indigo-400 hover:underline">
          ← 콘텐츠 생성
        </Link>
      </header>

      {/* 입력 */}
      <section className="space-y-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예) 블랙홀이 빛도 삼키는 이유"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 outline-none focus:border-neutral-400"
        />
        <div className="flex items-center gap-3">
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as "short" | "normal")}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="short">짧게 (4~5장면)</option>
            <option value="normal">보통 (6~8장면)</option>
          </select>
          <button
            onClick={generate}
            disabled={loading}
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 font-semibold transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "AI가 대본·장면 구성 중…" : "🎬 영상 자동 생성"}
          </button>
        </div>
      </section>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* 플레이어 */}
      {board && scene && (
        <section className="mt-6">
          {/* 16:9 무대 */}
          <div
            className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: MOOD_BG[scene.mood] }}
          >
            <div
              key={current}
              className="px-8 text-center"
              style={{ animation: "kenburns 6s ease-out forwards" }}
            >
              <p
                className="text-3xl font-extrabold leading-tight text-white drop-shadow-lg sm:text-5xl"
                style={{ animation: "slideUp 0.7s ease-out both" }}
              >
                {scene.onScreenText}
              </p>
              <p
                className="mx-auto mt-4 max-w-xl text-sm text-white/85 sm:text-base"
                style={{ animation: "fadeIn 1s ease-out 0.3s both" }}
              >
                {scene.narration}
              </p>
            </div>

            {/* 장면 인디케이터 */}
            <div className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-1 text-xs text-white">
              {current + 1} / {board.scenes.length}
            </div>
            {done && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <span className="text-lg font-semibold">▶ 다시 재생하려면 아래 버튼</span>
              </div>
            )}
          </div>

          {/* 진행바 */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 컨트롤 */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handlePlay}
              className="rounded-xl bg-white px-5 py-2.5 font-semibold text-neutral-900"
            >
              {playing ? "⏸ 일시정지" : done ? "↻ 다시 재생" : "▶ 재생"}
            </button>
            <button
              onClick={handleRestart}
              className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm"
            >
              처음부터
            </button>
            <span className="ml-auto text-sm text-neutral-400">{board.title}</span>
          </div>

          {/* 대본 */}
          <details className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <summary className="cursor-pointer text-sm font-medium text-neutral-300">
              📜 대본 · 장면 구성 보기
            </summary>
            <p className="mt-3 text-xs text-neutral-500">썸네일 후킹: {board.hook}</p>
            <ol className="mt-3 space-y-3">
              {board.scenes.map((s, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-3 text-sm ${
                    i === current ? "border-indigo-500 bg-indigo-500/10" : "border-neutral-800"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs">#{i + 1}</span>
                    <span className="font-semibold">{s.onScreenText}</span>
                    <span className="ml-auto text-xs text-neutral-500">{s.mood}</span>
                  </div>
                  <p className="text-neutral-300">{s.narration}</p>
                  <p className="mt-1 text-xs text-neutral-500">🎨 {s.visual}</p>
                </li>
              ))}
            </ol>
          </details>

          <p className="mt-3 text-center text-xs text-neutral-500">
            * 현재는 브라우저 음성(TTS)+애니메이션 미리보기입니다. 다음 단계에서 장면별 AI 이미지와
            MP4 렌더링·유튜브 자동 업로드를 연동합니다.
          </p>
        </section>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kenburns {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>
    </main>
  );
}
