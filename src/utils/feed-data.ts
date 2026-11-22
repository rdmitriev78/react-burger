import { ingredients } from '@utils/ingredients';

import type { TFeedOrder } from '@app-types/feed-order';
import type { TIngredient } from '@app-types/ingredient';

const bun = '60666c42cc7b410027a1a9b2';
const craterBun = '60666c42cc7b410027a1a9b1';
const fillet = '60666c42cc7b410027a1a9b3';
const meteor = '60666c42cc7b410027a1a9b5';
const rings = '60666c42cc7b410027a1a9bb';
const sauce = '60666c42cc7b410027a1a9b9';
const fruit = '60666c42cc7b410027a1a9bc';
const salad = '60666c42cc7b410027a1a9be';
const meat = '60666c42cc7b410027a1a9b4';
const spicy = '60666c42cc7b410027a1a9b7';
const cheese = '60666c42cc7b410027a1a9bf';
const patty = '60666c42cc7b410027a1a9b6';
const spaceSauce = '60666c42cc7b410027a1a9b8';

// Демонстрационные цены относятся только к ленте, каталог конструктора не меняется.
const prices: Record<string, number> = {
  [bun]: 20,
  [craterBun]: 50,
  [fillet]: 300,
  [meteor]: 90,
  [rings]: 20,
  [sauce]: 30,
  [fruit]: 80,
  [salad]: 60,
  [meat]: 40,
  [spicy]: 20,
  [cheese]: 20,
  [patty]: 190,
  [spaceSauce]: 80,
};

export const feedIngredients: Record<string, TIngredient> = Object.fromEntries(
  ingredients.map((ingredient) => [
    ingredient._id,
    { ...ingredient, price: prices[ingredient._id] ?? ingredient.price },
  ])
);

const now = new Date();
// Только прошедшие моменты: FormattedDate считает полные интервалы по 24 часа.
const date = (daysAgo: number, hoursAgo: number, minutesAgo: number): string =>
  new Date(
    now.getTime() - ((daysAgo * 24 + hoursAgo) * 60 + minutesAgo) * 60_000
  ).toISOString();

// Повторы, включая две половины булки, хранятся в составе явно.
export const feedOrders: TFeedOrder[] = [
  {
    id: '34535',
    number: 34535,
    name: 'Death Star Starship Main бургер',
    status: 'created',
    createdAt: date(0, 0, 40),
    ingredients: [bun, fillet, meteor, rings, sauce, bun],
  },
  {
    id: '34534',
    number: 34534,
    name: 'Interstellar бургер',
    status: 'created',
    createdAt: date(0, 3, 40),
    ingredients: [bun, fillet, meteor, rings, sauce, meat, spicy, cheese, bun],
  },
  {
    id: '34533',
    number: 34533,
    name: 'Black Hole Singularity острый бургер',
    status: 'done',
    createdAt: date(1, 3, 10),
    ingredients: [bun, fillet, fruit, sauce, salad, bun],
  },
  {
    id: '34532',
    number: 34532,
    name: 'Supernova Infinity бургер',
    status: 'done',
    createdAt: date(2, 0, 0),
    ingredients: [craterBun, patty, spaceSauce, craterBun],
  },
  {
    id: '34530',
    number: 34530,
    name: 'Космический двойной бургер',
    status: 'done',
    createdAt: date(2, 1, 40),
    ingredients: [bun, meteor, meteor, sauce, bun],
  },
  {
    id: '34527',
    number: 34527,
    name: 'Галактический бургер',
    status: 'done',
    createdAt: date(3, 3, 25),
    ingredients: [craterBun, fillet, sauce, cheese, craterBun],
  },
  {
    id: '34525',
    number: 34525,
    name: 'Бургер с края Вселенной',
    status: 'done',
    createdAt: date(3, 4, 10),
    ingredients: [bun, fruit, salad, spaceSauce, bun],
  },
  {
    id: '34538',
    number: 34538,
    name: 'Метеоритный бургер',
    status: 'pending',
    createdAt: date(0, 0, 30),
    ingredients: [bun, meteor, rings, sauce, bun],
  },
  {
    id: '34541',
    number: 34541,
    name: 'Бургер для межзвёздного путешествия',
    status: 'pending',
    createdAt: date(0, 0, 20),
    ingredients: [craterBun, meat, spicy, salad, craterBun],
  },
  {
    id: '34542',
    number: 34542,
    name: 'Stellar Special бургер',
    status: 'pending',
    createdAt: date(0, 0, 10),
    ingredients: [bun, fillet, meteor, rings, sauce, fruit, salad, meat, cheese, bun],
  },
];

export const feedTotals = { total: 28752, today: 138 };
