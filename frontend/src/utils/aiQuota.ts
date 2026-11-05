import type { createClient } from '@/utils/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * AI 호출 전에 사용량을 차감합니다. 허용되면 null, 아니면 사용자에게 보여 줄 오류 문구를 돌려줍니다.
 * 확인에 실패하면 비용이 드는 호출을 막기 위해 거부합니다.
 */
export async function consumeAiQuota(
  supabase: SupabaseServerClient,
  kind: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('consume_ai_quota', { p_kind: kind });

  if (error || !data) {
    return 'AI 기능을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }

  return data.allowed ? null : data.message;
}
