-- ─── 测试账号 ───────────────────────────────────────────────────────────────
-- Email:    dev@stackpulse.local
-- Password: Test1234!
--
-- 使用方式：supabase db reset（本地）或手动执行此文件
-- 注意：crypt() 需要 pgcrypto 扩展，Supabase 默认已启用
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'authenticated',
  'authenticated',
  'dev@stackpulse.local',
  crypt('Test1234!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'dev@stackpulse.local',
  '{"sub":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","email":"dev@stackpulse.local"}',
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;
