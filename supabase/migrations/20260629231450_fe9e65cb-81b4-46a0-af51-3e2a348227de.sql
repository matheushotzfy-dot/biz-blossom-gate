-- Defensive backend validation on products (frontend can still validate, but DB is source of truth)
ALTER TABLE public.products
  ADD CONSTRAINT products_name_length_check
    CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  ADD CONSTRAINT products_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 10000),
  ADD CONSTRAINT products_price_range_check
    CHECK (price >= 0 AND price <= 10000000);