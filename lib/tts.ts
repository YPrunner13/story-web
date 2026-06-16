// 고품질 TTS — 표현력 있는 캐릭터 음성용. ElevenLabs 기본, 키 없으면 미설정 처리.
//
// 다른 제공자로 교체하려면 synthesize()만 바꾸면 된다.
// 클라이언트는 키 미설정/실패 시 브라우저 음성(TTS)으로 자동 폴백한다.

export type Tone = "anime" | "narrator" | "calm";

// 톤별 음성 표현 강도 (style↑·stability↓ = 감정 풍부)
const VOICE_SETTINGS: Record<Tone, { stability: number; similarity_boost: number; style: number }> = {
  anime: { stability: 0.3, similarity_boost: 0.75, style: 0.65 },
  narrator: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
  calm: { stability: 0.7, similarity_boost: 0.7, style: 0.1 },
};

// ElevenLabs 기본 라이브러리 보이스 (env로 교체 가능)
const DEFAULT_VOICE_ID = "TxGEqnHWrfWFTfGW9XjX"; // Josh (젊은 남성)

export function ttsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesize(text: string, tone: Tone): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY 미설정");

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const model = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: VOICE_SETTINGS[tone] ?? VOICE_SETTINGS.anime,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
