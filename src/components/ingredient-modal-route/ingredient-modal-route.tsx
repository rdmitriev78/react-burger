import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { useGetIngredientsQuery } from '@services/api/burger-api';
import { selectIngredientById } from '@services/ingredients/ingredients-selectors';
import {
  closeRouteModal,
  openErrorModal,
  openIngredientModal,
} from '@services/modal/modal-slice';

export const IngredientModalRoute = (): null => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  // Подписка использует тот же кеш, что и Home. Загрузку и ошибку без данных показывает Home.
  const { data: ingredients } = useGetIngredientsQuery();
  const hasIngredients = ingredients !== undefined;
  const ingredient = useAppSelector((state) => selectIngredientById(state, id));

  // Очистка относится к маршруту и id, а не к обновлению данных или флагов запроса.
  useEffect(
    () => (): void => {
      dispatch(closeRouteModal());
    },
    [dispatch, id]
  );

  useEffect(() => {
    if (!hasIngredients) return;

    if (ingredient) {
      dispatch(openIngredientModal(ingredient));
    } else {
      dispatch(
        openErrorModal({
          source: 'route',
          title: 'Ингредиент не найден',
          message:
            'Проверьте ссылку или выберите другой ингредиент на главной странице.',
          buttonText: 'Закрыть',
        })
      );
    }
  }, [dispatch, id, ingredient, hasIngredients]);

  return null;
};
