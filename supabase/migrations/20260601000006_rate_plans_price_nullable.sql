-- price_per_night mora biti nullable za plan_type = 'seasonal'
ALTER TABLE rate_plans ALTER COLUMN price_per_night DROP NOT NULL;
