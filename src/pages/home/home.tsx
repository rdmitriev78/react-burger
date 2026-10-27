import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { BurgerConstructorDragLayer } from '@components/burger-constructor-drag-layer/burger-constructor-drag-layer';
import { BurgerConstructor } from '@components/burger-constructor/burger-constructor';
import { BurgerIngredients } from '@components/burger-ingredients/burger-ingredients';
import { ErrorView } from '@components/error-view/error-view';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useGetIngredientsQuery } from '@services/api/burger-api';

import styles from './home.module.css';

export const Home = (): React.JSX.Element => {
  const {
    data: ingredients,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetIngredientsQuery();
  const showError = isError && !ingredients;

  return (
    <DndProvider backend={HTML5Backend}>
      {!showError && (
        <h1 className={`${styles.title} text text_type_main-large mt-10 mb-5 pl-5`}>
          Соберите бургер
        </h1>
      )}
      {(isLoading || isFetching) && !ingredients && (
        <div className="mt-20">
          <RequestLoading message="Загружаем ингредиенты…" />
        </div>
      )}
      {showError && (
        <main className={styles.error}>
          <ErrorView
            title="Не удалось загрузить ингредиенты"
            message="Попробуйте повторить загрузку или зайдите немного позже."
            buttonText="Повторить загрузку"
            onButtonClick={() => void refetch()}
          />
        </main>
      )}
      {ingredients && (
        <main className={`${styles.main} pl-5 pr-5`} aria-busy={isFetching}>
          <BurgerIngredients />
          <BurgerConstructor />
        </main>
      )}
      <BurgerConstructorDragLayer />
    </DndProvider>
  );
};
