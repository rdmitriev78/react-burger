import { AppHeader } from '@components/app-header/app-header';
import { AppModals } from '@components/app-modals/app-modals';
import { BurgerConstructor } from '@components/burger-constructor/burger-constructor';
import { BurgerIngredients } from '@components/burger-ingredients/burger-ingredients';
import { ErrorView } from '@components/error-view/error-view';
import { RequestLoading } from '@components/request-loading/request-loading';
import { useGetIngredientsQuery } from '@services/api/burger-api';

import styles from './app.module.css';

export const App = (): React.JSX.Element => {
  const {
    data: ingredients,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetIngredientsQuery();
  const showError = isError && !ingredients;

  return (
    <div className={styles.app}>
      <AppHeader />
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
      <AppModals />
    </div>
  );
};

export default App;
