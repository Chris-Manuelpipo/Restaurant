-- ═══════════════════════════════════════════════════════════════════════════
--  Règle du prix, tenue en base
--
--  Un plat a SOIT un prix de base, SOIT au moins une variante — jamais les deux,
--  jamais aucun des deux. Zod le vérifie à l'entrée de l'API ; ici on le tient
--  pour de bon, y compris face à un import, un script ou une console psql.
--
--  L'invariant portant sur deux tables, un CHECK ne suffit pas : on passe par
--  des triggers de contrainte DIFFÉRÉS, évalués au COMMIT. C'est ce qui permet
--  à Prisma d'insérer le plat puis ses variantes dans la même transaction.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION evolyx_check_item_pricing(p_item_id TEXT) RETURNS VOID AS $$
DECLARE
  v_base     INTEGER;
  v_exists   BOOLEAN;
  v_variants INTEGER;
BEGIN
  SELECT TRUE, "basePrice" INTO v_exists, v_base
  FROM "MenuItem" WHERE "id" = p_item_id;

  -- Le plat a disparu dans la même transaction : plus rien à vérifier.
  IF v_exists IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_variants FROM "MenuItemVariant" WHERE "menuItemId" = p_item_id;

  IF v_base IS NOT NULL AND v_variants > 0 THEN
    RAISE EXCEPTION 'Plat %: un prix de base ET des variantes. Choisissez l''un ou l''autre.', p_item_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_base IS NULL AND v_variants = 0 THEN
    RAISE EXCEPTION 'Plat %: ni prix de base ni variante. Le plat serait incommandable.', p_item_id
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION evolyx_menu_item_pricing_guard() RETURNS TRIGGER AS $$
BEGIN
  PERFORM evolyx_check_item_pricing(NEW."id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION evolyx_variant_pricing_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM evolyx_check_item_pricing(OLD."menuItemId");
  ELSE
    PERFORM evolyx_check_item_pricing(NEW."menuItemId");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER menu_item_pricing_check
  AFTER INSERT OR UPDATE ON "MenuItem"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evolyx_menu_item_pricing_guard();

CREATE CONSTRAINT TRIGGER menu_item_variant_pricing_check
  AFTER INSERT OR UPDATE OR DELETE ON "MenuItemVariant"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evolyx_variant_pricing_guard();

-- ── Garde-fous simples, vérifiables colonne par colonne ────────────────────
ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_basePrice_positive" CHECK ("basePrice" IS NULL OR "basePrice" >= 0);

ALTER TABLE "MenuItemVariant"
  ADD CONSTRAINT "MenuItemVariant_price_positive" CHECK ("price" >= 0);

ALTER TABLE "MenuItemSupplement"
  ADD CONSTRAINT "MenuItemSupplement_price_positive" CHECK ("price" >= 0);

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT "AvailabilityRule_discount_range"
  CHECK ("discountPercent" IS NULL OR ("discountPercent" > 0 AND "discountPercent" <= 100));

-- Les codes d'accès sont immuables : on l'écrit noir sur blanc plutôt que de
-- compter sur la discipline du code applicatif.
CREATE OR REPLACE FUNCTION evolyx_access_point_code_is_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."code" IS DISTINCT FROM OLD."code" THEN
    RAISE EXCEPTION 'Le code d''un point d''accès ne change jamais : il est imprimé.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_point_code_immutable
  BEFORE UPDATE ON "AccessPoint"
  FOR EACH ROW EXECUTE FUNCTION evolyx_access_point_code_is_immutable();
