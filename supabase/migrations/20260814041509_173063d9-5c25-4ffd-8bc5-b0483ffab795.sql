insert into public.coupons (user_id, code, product_id, discount_type, discount_value, is_active)
values ('30587fc1-3801-4222-9b40-d5f2c73379ec','QATEST10','faed2ade-a26e-4dbb-8d02-d05f9f3efaf5','percentage',10,true)
on conflict do nothing;