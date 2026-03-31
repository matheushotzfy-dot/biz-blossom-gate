
-- Fix upsert targets: add unique constraints where missing

-- retention_settings: allow only one entry per user (null for global)
-- First clean up any duplicates
DELETE FROM public.retention_settings a USING public.retention_settings b 
WHERE a.id < b.id AND a.user_id IS NOT DISTINCT FROM b.user_id;

ALTER TABLE public.retention_settings ADD CONSTRAINT retention_settings_user_id_unique UNIQUE (user_id);

-- custom_user_fees: one fee config per user
DELETE FROM public.custom_user_fees a USING public.custom_user_fees b
WHERE a.id < b.id AND a.user_id = b.user_id;

ALTER TABLE public.custom_user_fees ADD CONSTRAINT custom_user_fees_user_id_unique UNIQUE (user_id);

-- seller_auto_withdraw: one config per user
DELETE FROM public.seller_auto_withdraw a USING public.seller_auto_withdraw b
WHERE a.id < b.id AND a.user_id = b.user_id;

ALTER TABLE public.seller_auto_withdraw ADD CONSTRAINT seller_auto_withdraw_user_id_unique UNIQUE (user_id);

-- user_progress: one progress entry per user per lesson
DELETE FROM public.user_progress a USING public.user_progress b
WHERE a.id < b.id AND a.user_id = b.user_id AND a.lesson_id = b.lesson_id;

ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_user_lesson_unique UNIQUE (user_id, lesson_id);
