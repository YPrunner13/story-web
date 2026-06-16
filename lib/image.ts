// 장면 이미지 생성 — 제공자 교체 가능하도록 URL 빌더로 추상화.
//
// 기본값: Pollinations (API 키 불필요, 프롬프트만으로 즉시 이미지 생성).
// 추후 OpenAI Images / Stability / Replicate 등으로 교체하려면
// 이 함수만 바꾸거나, 서버에서 이미지를 생성해 URL을 내려주면 된다.

const IMAGE_BASE =
  process.env.NEXT_PUBLIC_IMAGE_BASE ?? "https://image.pollinations.ai/prompt";

export function sceneImageUrl(prompt: string, seed = 0): string {
  const encoded = encodeURIComponent(prompt.slice(0, 400));
  const params = new URLSearchParams({
    width: "1280",
    height: "720",
    nologo: "true",
    seed: String(seed),
  });
  return `${IMAGE_BASE}/${encoded}?${params.toString()}`;
}
