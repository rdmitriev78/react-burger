import type { TIngredient } from '@app-types/ingredient';

const ingredient = (
  suffix: string,
  name: string,
  type: TIngredient['type'],
  price: number
): TIngredient => ({
  _id: `60666c42cc7b410027a1a9${suffix}`,
  name,
  type,
  price,
  proteins: 0,
  fat: 0,
  carbohydrates: 0,
  calories: 0,
  __v: 0,
  image: '/test-ingredient.svg',
  image_mobile: '/test-ingredient.svg',
  image_large: '/test-ingredient.svg',
});

export const testIngredients: TIngredient[] = [
  ingredient('b2', 'Флюоресцентная булка', 'bun', 20),
  ingredient('b3', 'Филе люминесцентного тетраодонтимформа', 'main', 300),
  ingredient('b5', 'Говяжий метеорит', 'main', 90),
  ingredient('bb', 'Хрустящие минеральные кольца', 'main', 20),
  ingredient('b9', 'Соус традиционный галактический', 'sauce', 30),
  ingredient('b4', 'Мясо бессмертных моллюсков', 'main', 40),
  ingredient('b7', 'Соус Spicy-X', 'sauce', 20),
  ingredient('bf', 'Сыр с астероидной плесенью', 'main', 20),
];
