import { invalidateMenuCache } from '../modules/public/cache.js';
import type { EventBus } from './bus.js';

/**
 * Abonnés du lot 1.
 *
 * Il n'y en a que deux, et c'est normal : le bus existe d'abord pour que les modules à venir
 * (Commande, Cuisine, Caisse) puissent se brancher sans toucher au socle. Le socle, lui, ne
 * connaît personne en aval.
 *
 *   menu_item.status_changed ──┐
 *   menu_item.updated        ──┼──▶ invalidation du cache du menu public
 *   restaurant.updated       ──┘
 *
 * Le journal d'audit, lui, s'écrit au plus près de l'action : il doit consigner *qui* a fait
 * *quoi*, information que l'événement ne porte pas toujours.
 */
export function registerCoreSubscribers(bus: EventBus): void {
  const invalidate = (payload: { restaurantId: string }) => {
    invalidateMenuCache(payload.restaurantId);
  };

  bus.subscribe('menu_item.updated', invalidate);
  bus.subscribe('menu_item.status_changed', invalidate);
  bus.subscribe('menu_item.price_changed', invalidate);
  bus.subscribe('category.updated', invalidate);
  bus.subscribe('restaurant.updated', invalidate);
  bus.subscribe('availability_rule.changed', invalidate);
  bus.subscribe('access_point.revoked', invalidate);
}
