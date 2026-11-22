export type TOrder = {
  id: string;
  number: number;
  name: string;
  status: 'created' | 'pending' | 'done';
  createdAt: string;
  ingredients: string[];
};
