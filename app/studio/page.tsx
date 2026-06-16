"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sceneImageUrl } from "@/lib/image";

type Mood = "calm" | "energetic" | "serious" | "playful" | "inspiring";

interface Scene {
  narration: string;
  onScreenText: string;
  visual: string;
  imagePrompt: string;
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

  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [imgLoaded, setImgLoaded] = useState<Set<number>>(new Set());

  // 스토리보드가 생기면 장면별 이미지 URL 구성 + 미리 로딩
  useEffect(() => {
    if (!board) {
      setImgUrls([]);
      setImgLoaded(new Set());
      return;
    }
    const urls = board.scenes.map((s, i) =>
      sceneImageUrl(s.imagePrompt || s.visual, i * 7 + 1),
    );
    setImgUrls(urls);
    setImgLoaded(new Set());
    urls.forEach((url, i) => {
      const img = new window.Image();
      img.onload = () => setImgLoaded((prev) => new Set(prev).add(i));
      img.src = url;
    });
  }, [board]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [rate, setRate] = useState(1.2);
  const [pitch, setPitch] = useState(1.3);

  // 사용 가능한 음성 준비 (한국어 우선)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      const sorted = [...list].sort(
        (a, b) =>
          (b.lang.startsWith("ko") ? 1 : 0) - (a.lang.startsWith("ko") ? 1 : 0),
      );
      setVoices(sorted);
      setVoiceName(
        (prev) => prev || sorted.find((v) => v.lang.startsWith("ko"))?.name || sorted[0]?.name || "",
      );
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.cancel();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function applyTone(preset: "anime" | "narrator" | "calm") {
    if (preset === "anime") {
      setRate(1.2);
      setPitch(1.3); // 활기찬 소년 애니 톤
    } else if (preset === "narrator") {
      setRate(1.0);
      setPitch(1.0);
    } else {
      setRate(0.92);
      setPitch(0.85);
    }
  }

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
      const chosen = voices.find((v) => v.name === voiceName);
      if (chosen) u.voice = chosen;
      u.rate = rate;
      u.pitch = pitch;
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

      {/* 캐릭터 목소리 톤 */}
      <section className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-2 text-sm font-medium text-neutral-300">🎙️ 목소리 톤</p>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => applyTone("anime")}
            className="rounded-full border border-neutral-700 px-3 py-1.5 hover:border-neutral-400"
          >
            활기찬 소년 애니 톤
          </button>
          <button
            onClick={() => applyTone("narrator")}
            className="rounded-full border border-neutral-700 px-3 py-1.5 hover:border-neutral-400"
          >
            기본 나레이터
          </button>
          <button
            onClick={() => applyTone("calm")}
            className="rounded-full border border-neutral-700 px-3 py-1.5 hover:border-neutral-400"
          >
            차분한 톤
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-neutral-400">
            음성
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100"
            >
              {voices.length === 0 && <option value="">기본 음성</option>}
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            속도 {rate.toFixed(2)}
            <input
              type="range"
              min={0.7}
              max={1.5}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-xs text-neutral-400">
            톤 높이 {pitch.toFixed(2)}
            <input
              type="range"
              min={0.5}
              max={1.6}
              step={0.05}
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          * 톤은 다음 재생부터 적용됩니다. 사용 가능한 음성은 브라우저/OS에 따라 달라요.
        </p>
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
            {/* AI 생성 장면 이미지 (배경) */}
            {imgUrls[current] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`img-${current}`}
                src={imgUrls[current]}
                alt={scene.visual}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ animation: "kenburns 6s ease-out forwards" }}
              />
            )}
            {/* 가독성용 어둡게 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />

            <div key={current} className="relative px-8 text-center">
              <p
                className="text-3xl font-extrabold leading-tight text-white drop-shadow-lg sm:text-5xl"
                style={{ animation: "slideUp 0.7s ease-out both" }}
              >
                {scene.onScreenText}
              </p>
              <p
                className="mx-auto mt-4 max-w-xl text-sm text-white/90 drop-shadow sm:text-base"
                style={{ animation: "fadeIn 1s ease-out 0.3s both" }}
              >
                {scene.narration}
              </p>
            </div>

            {/* 장면 인디케이터 */}
            <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-1 text-xs text-white">
              {current + 1} / {board.scenes.length}
            </div>
            {/* 이미지 생성 진행 */}
            {imgUrls.length > 0 && imgLoaded.size < imgUrls.length && (
              <div className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-1 text-xs text-white">
                🎨 이미지 생성 중 {imgLoaded.size}/{imgUrls.length}
              </div>
            )}
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
            * 장면별 AI 이미지 + 브라우저 음성(TTS) + 애니메이션 미리보기입니다. 다음 단계에서
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
