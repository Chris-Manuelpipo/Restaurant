/**
 * Bus d'événements métier.
 *
 * Le socle publie ; il ne connaît aucun module aval. Au lot 1, deux abonnés seulement —
 * l'invalidation du cache du menu public et le journal d'audit — et c'est voulu : le bus
 * existe pour que Commande, Cuisine ou Caisse puissent s'y brancher plus tard sans qu'une
 * seule ligne du socle ne change.
 *
 * L'implémentation est en mémoire, derrière une interface. Passer à Redis ou à une file
 * revient à fournir une autre implémentation de `EventBus` — les publieurs n'en sauront rien.
 */

import type { ItemStatus, TableStatus } from '@evolyx/shared';

export interface DomainEvents {
  'menu_item.updated': {
    restaurantId: string;
    itemId: string;
    changedFields: string[];
    userId?: string;
  };
  'menu_item.status_changed': {
    restaurantId: string;
    itemId: string;
    from: ItemStatus;
    to: ItemStatus;
    userId?: string;
  };
  'menu_item.price_changed': {
    restaurantId: string;
    itemId: string;
    from: number | null;
    to: number | null;
    userId?: string;
  };
  'category.updated': { restaurantId: string; categoryId: string; userId?: string };
  'restaurant.updated': { restaurantId: string; changedFields: string[]; userId?: string };
  'availability_rule.changed': { restaurantId: string; ruleId: string; userId?: string };
  'access_point.created': { restaurantId: string; accessPointIds: string[]; userId?: string };
  'access_point.revoked': { restaurantId: string; accessPointId: string; code: string; userId?: string };
  'table.status_changed': {
    restaurantId: string;
    tableId: string;
    from: TableStatus;
    to: TableStatus;
    userId?: string;
  };
  'user.created': { restaurantId: string; userId: string; role: string; actorId?: string };
  'user.deactivated': { restaurantId: string; userId: string; actorId?: string };
}

export type EventName = keyof DomainEvents;
export type EventHandler<K extends EventName> = (payload: DomainEvents[K]) => void | Promise<void>;

export interface EventBus {
  publish<K extends EventName>(name: K, payload: DomainEvents[K]): Promise<void>;
  subscribe<K extends EventName>(name: K, handler: EventHandler<K>): () => void;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventName, Set<EventHandler<EventName>>>();
  private readonly onError: (error: unknown, name: EventName) => void;

  constructor(onError?: (error: unknown, name: EventName) => void) {
    this.onError =
      onError ??
      ((error, name) => {
        // Un abonné qui échoue ne doit jamais faire échouer la requête qui a publié.
        console.error(`[events] abonné en échec sur « ${name} »`, error);
      });
  }

  subscribe<K extends EventName>(name: K, handler: EventHandler<K>): () => void {
    const set = this.handlers.get(name) ?? new Set();
    set.add(handler as EventHandler<EventName>);
    this.handlers.set(name, set);
    return () => set.delete(handler as EventHandler<EventName>);
  }

  async publish<K extends EventName>(name: K, payload: DomainEvents[K]): Promise<void> {
    const set = this.handlers.get(name);
    if (!set || set.size === 0) return;

    await Promise.all(
      [...set].map(async (handler) => {
        try {
          await handler(payload);
        } catch (error) {
          this.onError(error, name);
        }
      }),
    );
  }

  /** Nombre d'abonnés — sert aux tests et au diagnostic. */
  countSubscribers(name: EventName): number {
    return this.handlers.get(name)?.size ?? 0;
  }
}
