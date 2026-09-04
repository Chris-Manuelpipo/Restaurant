/**
 * Préambule commun aux suites de tests.
 * Les tests unitaires du domaine n'ont besoin de rien ; les tests d'intégration
 * s'appuient sur `TEST_DATABASE_URL` et montent leur propre serveur.
 */
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-de-trente-deux-caracteres-minimum';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-de-trente-deux-caracteres-minimum';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/evolyx_restaurant_test?schema=public';
