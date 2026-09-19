-- ==============================================================================
-- 02_google_oauth_support.sql
-- Google OAuth 가입 유저를 위한 프로필 트리거 개선 및 온보딩 지원
-- ==============================================================================

-- 1. profiles의 role을 가입 직후 온보딩 전까지 NULL 허용하도록 제약조건 수정
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('teacher', 'student') OR role IS NULL);

-- 2. 신규 가입 트리거 개선 (Google OAuth의 full_name, picture 메타데이터 반영)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'role', -- 없으면 NULL (온보딩에서 선택)
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

