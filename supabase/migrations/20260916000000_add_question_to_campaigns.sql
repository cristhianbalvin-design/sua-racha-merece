-- Add question column to campaigns table for challenge questions
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS question text;
