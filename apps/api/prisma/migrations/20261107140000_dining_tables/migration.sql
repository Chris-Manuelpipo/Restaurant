-- Les tables de la salle deviennent une entité à part entière, distincte du carton QR.

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "zone" TEXT,
    "status" "TableStatus" NOT NULL DEFAULT 'FREE',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessPointId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_accessPointId_key" ON "DiningTable"("accessPointId");

-- CreateIndex
CREATE INDEX "DiningTable_restaurantId_archivedAt_idx" ON "DiningTable"("restaurantId", "archivedAt");

-- CreateIndex
CREATE INDEX "DiningTable_restaurantId_zone_idx" ON "DiningTable"("restaurantId", "zone");

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_accessPointId_fkey" FOREIGN KEY ("accessPointId") REFERENCES "AccessPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Garde-fous ─────────────────────────────────────────────────────────────
ALTER TABLE "DiningTable"
  ADD CONSTRAINT "DiningTable_seats_range" CHECK ("seats" BETWEEN 1 AND 100);

-- Deux tables en service ne portent pas le même nom : le serveur doit savoir où aller.
-- Une table archivée libère son nom.
CREATE UNIQUE INDEX "DiningTable_restaurantId_label_active_key"
  ON "DiningTable"("restaurantId", lower("label"))
  WHERE "archivedAt" IS NULL;

-- Un code QR ne se rattache qu'à une table du même restaurant. L'API le vérifie déjà ;
-- la base le refuse aussi, pour qu'aucun chemin de code ne puisse l'oublier.
CREATE OR REPLACE FUNCTION evolyx_dining_table_access_point_same_restaurant() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."accessPointId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "AccessPoint"
    WHERE "id" = NEW."accessPointId" AND "restaurantId" = NEW."restaurantId"
  ) THEN
    RAISE EXCEPTION 'Ce code QR appartient à un autre restaurant.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dining_table_access_point_same_restaurant
  BEFORE INSERT OR UPDATE OF "accessPointId", "restaurantId" ON "DiningTable"
  FOR EACH ROW EXECUTE FUNCTION evolyx_dining_table_access_point_same_restaurant();

-- ── Reprise de l'existant ──────────────────────────────────────────────────
-- Chaque code QR de type TABLE encore valable devient une table, déjà reliée à son carton.
-- En cas de libellés en double dans un même restaurant, seul le plus ancien est repris :
-- les autres codes restent intacts et pourront être rattachés à la main.
INSERT INTO "DiningTable" ("id", "restaurantId", "label", "accessPointId", "sortOrder", "createdAt", "updatedAt")
SELECT
  'tbl_' || replace(gen_random_uuid()::text, '-', ''),
  ap."restaurantId",
  ap."label",
  ap."id",
  (row_number() OVER (PARTITION BY ap."restaurantId" ORDER BY ap."createdAt", ap."id"))::int,
  ap."createdAt",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("restaurantId", lower("label")) *
  FROM "AccessPoint"
  WHERE "kind" = 'TABLE' AND "revokedAt" IS NULL
  ORDER BY "restaurantId", lower("label"), "createdAt", "id"
) AS ap;
