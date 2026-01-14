-- Migration: Add days_per_year to leave_types
-- Description: Adds missing column required for leave balance calculation

ALTER TABLE public.leave_types
ADD COLUMN IF NOT EXISTS days_per_year integer DEFAULT 30 NOT NULL;

COMMENT ON COLUMN public.leave_types.days_per_year IS 'Total allowed leave days per fiscal year for this leave type';
