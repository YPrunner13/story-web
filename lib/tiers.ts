// Free / Pro 티어 정의 — 같은 엔진, 다른 권한.
// 결제 연동(Stripe 등) 전까지는 이 규칙으로 기능을 게이팅한다.

export type Tier = "free" | "pro";

export type Channel = "instagram" | "blog" | "x" | "threads";

export interface TierLimits {
  /** 하루 생성 가능 건수 (Infinity = 무제한) */
  dailyGenerations: number;
  /** 사용 가능한 채널 */
  channels: Channel[];
  /** 예약 발행 가능 여부 */
  scheduling: boolean;
  /** 브랜드 보이스(톤) 고정 가능 여부 */
  brandVoice: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    dailyGenerations: 3,
    channels: ["instagram"],
    scheduling: false,
    brandVoice: false,
  },
  pro: {
    dailyGenerations: Infinity,
    channels: ["instagram", "blog", "x", "threads"],
    scheduling: true,
    brandVoice: true,
  },
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: "인스타그램 캡션",
  blog: "블로그 글",
  x: "X(트위터) 포스트",
  threads: "스레드",
};

export function canUseChannel(tier: Tier, channel: Channel): boolean {
  return TIER_LIMITS[tier].channels.includes(channel);
}
