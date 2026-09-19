import { Tab } from '@krgaa/react-developer-burger-ui-components';

import { BurgerIngredientsSection } from '../burger-ingredients-section/burger-ingredients-section';

import type { TIngredient } from '@utils/types';

import styles from './burger-ingredients.module.css';

const ingredientSections = [
  { type: 'bun', title: 'Булки' },
  { type: 'main', title: 'Начинки' },
  { type: 'sauce', title: 'Соусы' },
] as const;

type TBurgerIngredientsProps = {
  ingredients: TIngredient[];
};

export const BurgerIngredients = ({
  ingredients,
}: TBurgerIngredientsProps): React.JSX.Element => {
  console.log(ingredients);

  return (
    <section className={styles.burger_ingredients}>
      <nav>
        <ul className={styles.menu}>
          {/* TODO: Переделать формирование Tab на использование ingredientSections */}
          <Tab
            value="bun"
            active={true}
            onClick={() => {
              /* TODO */
            }}
          >
            Булки
          </Tab>
          <Tab
            value="main"
            active={false}
            onClick={() => {
              /* TODO */
            }}
          >
            Начинки
          </Tab>
          <Tab
            value="sauce"
            active={false}
            onClick={() => {
              /* TODO */
            }}
          >
            Соусы
          </Tab>
        </ul>
      </nav>

      <div className={`${styles.menu_items} mt-10 custom-scroll`}>
        {ingredientSections.map(({ type, title }) => (
          <BurgerIngredientsSection
            key={type}
            title={title}
            ingredients={ingredients.filter((ingredient) => ingredient.type === type)}
          />
        ))}
      </div>
    </section>
  );
};
