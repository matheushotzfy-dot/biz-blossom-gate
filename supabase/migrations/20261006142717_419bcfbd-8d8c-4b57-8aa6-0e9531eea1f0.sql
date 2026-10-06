DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('app_private.get_admin_analytics_detail(date,date,integer,text,boolean,text)'::regprocedure) INTO definition;
 IF position('(SELECT count(*) FROM sellers s WHERE (s.created_at AT TIME ZONE ''America/Sao_Paulo'')::date=d::date)' in definition)=0 THEN RAISE EXCEPTION 'Analytics definition did not match expected version'; END IF;
 definition:=replace(definition, '), daily AS (', '), registrations_by_day AS (SELECT (created_at AT TIME ZONE ''America/Sao_Paulo'')::date AS day,count(*) AS registrations FROM sellers WHERE created_at>=v_from AND created_at<v_to GROUP BY 1), daily AS (');
 definition:=replace(definition, '(SELECT count(*) FROM sellers s WHERE (s.created_at AT TIME ZONE ''America/Sao_Paulo'')::date=d::date) registrations', 'coalesce(max(r.registrations),0) registrations');
 definition:=replace(definition, 'LEFT JOIN tx t ON t.day=d::date GROUP BY d', 'LEFT JOIN tx t ON t.day=d::date LEFT JOIN registrations_by_day r ON r.day=d::date GROUP BY d');
 EXECUTE definition;
END $migration$;