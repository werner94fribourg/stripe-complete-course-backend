import { OrderItemDto } from '../dtos/order-item.dto';

export interface Order {
  id: string;
  userId: string;
  items: OrderItemDto[];
  total: number;
  pending: boolean;
  isFailed: boolean;
  createdAt: Date;
}
