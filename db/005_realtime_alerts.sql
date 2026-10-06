-- Migration 005: Add alerts table to Supabase Realtime publication
-- Run this in your Supabase SQL Editor if alerts are not publishing over WebSockets automatically.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END $$;

-- Enable REPLICA IDENTITY FULL so updates/deletes contain full payload
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
