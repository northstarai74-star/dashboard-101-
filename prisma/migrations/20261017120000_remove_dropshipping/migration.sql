-- Dropshipping is no longer a service. Keep the existing records but mark them Unassigned
-- so the owner can reassign them. Deals keep their revenue under UNASSIGNED.
UPDATE "Lead" SET "service" = 'UNASSIGNED' WHERE "service" = 'DROPSHIPPING';
UPDATE "Deal" SET "service" = 'UNASSIGNED' WHERE "service" = 'DROPSHIPPING';
DELETE FROM "AssignmentRule" WHERE "service" = 'DROPSHIPPING';
