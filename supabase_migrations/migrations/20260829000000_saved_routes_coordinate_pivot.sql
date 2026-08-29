-- Migration: Pivot saved_routes to arbitrary coordinate-based routing
-- Date: 2026-08-29

-- 1. Alter saved_routes table to remove the foreign key to the fixed routes table
-- and add origin/destination coordinates and names directly.

ALTER TABLE saved_routes
    DROP CONSTRAINT IF EXISTS saved_routes_route_id_fkey;

-- Drop route_id column
ALTER TABLE saved_routes
    DROP COLUMN IF EXISTS route_id;

-- Add coordinate-based route columns
ALTER TABLE saved_routes
    ADD COLUMN IF NOT EXISTS origin_name TEXT NOT NULL DEFAULT 'Origin',
    ADD COLUMN IF NOT EXISTS origin_lat NUMERIC NOT NULL DEFAULT 12.9716,
    ADD COLUMN IF NOT EXISTS origin_lng NUMERIC NOT NULL DEFAULT 77.5946,
    ADD COLUMN IF NOT EXISTS dest_name TEXT NOT NULL DEFAULT 'Destination',
    ADD COLUMN IF NOT EXISTS dest_lat NUMERIC NOT NULL DEFAULT 12.9716,
    ADD COLUMN IF NOT EXISTS dest_lng NUMERIC NOT NULL DEFAULT 77.5946;

-- Remove defaults after column creation
ALTER TABLE saved_routes
    ALTER COLUMN origin_name DROP DEFAULT,
    ALTER COLUMN origin_lat DROP DEFAULT,
    ALTER COLUMN origin_lng DROP DEFAULT,
    ALTER COLUMN dest_name DROP DEFAULT,
    ALTER COLUMN dest_lat DROP DEFAULT,
    ALTER COLUMN dest_lng DROP DEFAULT;

-- Ensure Row Level Security (RLS) is enabled
ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

-- Ensure RLS Policies for authenticated users
DROP POLICY IF EXISTS "Users can select their own saved routes" ON saved_routes;
CREATE POLICY "Users can select their own saved routes"
ON saved_routes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved routes" ON saved_routes;
CREATE POLICY "Users can insert their own saved routes"
ON saved_routes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own saved routes" ON saved_routes;
CREATE POLICY "Users can update their own saved routes"
ON saved_routes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved routes" ON saved_routes;
CREATE POLICY "Users can delete their own saved routes"
ON saved_routes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
