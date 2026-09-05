import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { PublicCategory } from '@evolyx/shared';
import { CategoryMark } from './CategoryMark';

/**
 * Barre de catégories collante.
 *
 * La catégorie active se déduit d'un `IntersectionObserver` — pas d'un écouteur de défilement,
 * qui ferait travailler le processeur à chaque pixel sur un téléphone d'entrée de gamme.
 */
export function CategoryNav({
  categories,
  onSelect,
}: {
  categories: PublicCategory[];
  onSelect: (categoryId: string) => void;
}): JSX.Element | null {
  const [active, setActive] = useState(categories[0]?.id ?? '');
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace('cat-', ''));
      },
      // La bande de détection commence sous la barre collante et couvre le haut de l'écran.
      { rootMargin: '-72px 0px -60% 0px', threshold: 0 },
    );

    for (const category of categories) {
      const node = document.getElementById(`cat-${category.id}`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [categories]);

  /* La puce active reste visible dans la barre, même quand elle est loin dans la liste. */
  useEffect(() => {
    const chip = barRef.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  if (categories.length === 0) return null;

  return (
    <nav className="nav-bar mt-5" aria-label="Catégories">
      <div className="nav-scroll" ref={barRef}>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            data-chip={category.id}
            className="chip"
            aria-current={category.id === active}
            onClick={() => onSelect(category.id)}
          >
            <CategoryMark icon={category.icon} imageUrl={category.imageUrl} size={15} />
            {category.name}
            <span className="count">{category.items.length}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
