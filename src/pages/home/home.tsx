import { useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Outlet, useNavigate } from 'react-router-dom';

import { BurgerConstructorDragLayer } from '@components/burger-constructor-drag-layer/burger-constructor-drag-layer';
import { BurgerConstructor } from '@components/burger-constructor/burger-constructor';
import { BurgerIngredients } from '@components/burger-ingredients/burger-ingredients';
import { ErrorView } from '@components/error-view/error-view';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useGetIngredientsQuery } from '@services/api/burger-api';

import type { TIngredient } from '@app-types/ingredient';

import styles from './home.module.css';

export const Home = (): React.JSX.Element => {
  // useNavigate подписывает компонент на контекст роутера. Держим его на уровне страницы,
  // чтобы смена URL не вызывала рендер каждой секции каталога; стабильный обработчик
  // передаём через пропсы, сохраняя возможность пропустить рендер с помощью memo.
  const navigate = useNavigate();
  const handleIngredientClick = useCallback(
    (ingredient: TIngredient): void => {
      // Отмечаем переход с главной, чтобы при закрытии модалки
      // вернуться назад по истории браузера.
      void navigate(`/ingredients/${ingredient._id}`, {
        state: { fromHome: true },
      });
    },
    [navigate]
  );
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
          <BurgerIngredients onIngredientClick={handleIngredientClick} />
          <BurgerConstructor />
        </main>
      )}
      <BurgerConstructorDragLayer />
      <Outlet />
    </DndProvider>
  );
};
