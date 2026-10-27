import { Tab } from '@krgaa/react-developer-burger-ui-components';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useAppSelector } from '@hooks/redux';
import { selectIngredientsByType } from '@services/ingredients/ingredients-selectors';

import { BurgerIngredientsSection } from '../burger-ingredients-section/burger-ingredients-section';

import type { TIngredient } from '@app-types/ingredient';

import styles from './burger-ingredients.module.css';

const ingredientSections = [
  { type: 'bun', title: 'Булки' },
  { type: 'main', title: 'Начинки' },
  { type: 'sauce', title: 'Соусы' },
] as const;

export const BurgerIngredients = memo(function BurgerIngredients(): React.JSX.Element {
  const ingredientsByType = useAppSelector(selectIngredientsByType);
  const [activeTab, setActiveTab] = useState<TIngredient['type']>('bun');
  const activeTabRef = useRef<TIngredient['type']>('bun');
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<TIngredient['type'], HTMLElement | null>>({
    bun: null,
    main: null,
    sauce: null,
  });

  const updateActiveTab = useCallback((): void => {
    const container = containerRef.current;
    if (!container || container.clientHeight === 0) return;

    const containerTop = container.getBoundingClientRect().top + container.clientTop;
    let closestType: TIngredient['type'] = 'bun';
    let closestDistance = Infinity;

    // Ищем ближайший раздел
    for (const { type } of ingredientSections) {
      const section = sectionRefs.current[type];
      if (!section) continue;

      const distance = Math.abs(section.getBoundingClientRect().top - containerTop);
      if (distance < closestDistance) {
        closestType = type;
        closestDistance = distance;
      }
    }

    // Последний раздел может не достигать верхней границы контейнера
    // Если прокрутили до самого низа, активируем последний таб
    if (
      container.scrollTop > 0 &&
      container.scrollHeight - container.clientHeight - container.scrollTop <= 1
    ) {
      closestType = ingredientSections[ingredientSections.length - 1].type;
    }

    if (activeTabRef.current === closestType) return;

    activeTabRef.current = closestType;
    setActiveTab(closestType);
  }, []);

  const scrollToSection = (type: TIngredient['type']): void => {
    sectionRefs.current[type]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  };

  useEffect(() => {
    updateActiveTab();

    const observer = new ResizeObserver(updateActiveTab);
    if (containerRef.current) observer.observe(containerRef.current);
    for (const { type } of ingredientSections) {
      const section = sectionRefs.current[type];
      if (section) observer.observe(section);
    }

    return (): void => observer.disconnect();
  }, [ingredientsByType, updateActiveTab]);

  console.log('BurgerIngredients');

  return (
    <section className={styles.burger_ingredients}>
      <nav>
        <ul className={styles.menu}>
          {ingredientSections.map(({ type, title }) => (
            <Tab
              key={type}
              value={type}
              active={activeTab === type}
              onClick={() => scrollToSection(type)}
            >
              {title}
            </Tab>
          ))}
        </ul>
      </nav>

      <div
        ref={containerRef}
        className={`${styles.menu_items} mt-10 custom-scroll`}
        onScroll={updateActiveTab}
      >
        {ingredientSections.map(({ type, title }) => (
          <section
            key={type}
            ref={(sectionRef) => {
              sectionRefs.current[type] = sectionRef;
            }}
          >
            <BurgerIngredientsSection
              title={title}
              ingredients={ingredientsByType[type]}
            />
          </section>
        ))}
      </div>
    </section>
  );
});
