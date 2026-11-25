import { Blocks, MessageCircle, Package, Receipt, UserRound, Wallet } from 'lucide-react';
import type { ComponentType } from 'react';
import type { CategoryId } from './supportModel';

export const CATEGORY_ICON: Record<CategoryId, ComponentType<{ className?: string }>> = {
  payouts: Wallet, sales: Receipt, products: Package, account: UserRound, integrations: Blocks, other: MessageCircle,
};
