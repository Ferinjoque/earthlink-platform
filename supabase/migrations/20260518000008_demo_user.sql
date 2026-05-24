-- Usuario demo para pruebas locales
-- email: admin@earthlink.test  |  password: Earthlink2025!
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@earthlink.test';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, aud, role, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000999',
      '00000000-0000-0000-0000-000000000000',
      'admin@earthlink.test',
      extensions.crypt('Earthlink2025!', extensions.gen_salt('bf')),
      now(), 'authenticated', 'authenticated', now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false
    );
    v_user_id := '00000000-0000-0000-0000-000000000999';
  END IF;

  INSERT INTO public.memberships (user_id, organization_id, supplier_id, role)
  VALUES
    (v_user_id, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', NULL, 'admin'),
    (v_user_id, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', NULL, 'admin')
  ON CONFLICT DO NOTHING;
END $$;
