import { create } from 'zustand';
import { CartItem } from '../../shared/types';

interface POSState {
  cart: CartItem[];
  selectedCustomer: { id: number; nameAr: string; phone: string } | null;
  heldCarts: CartItem[][];
  discount: number;
  paymentMethod: string;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updateDiscount: (productId: number, discount: number) => void;
  clearCart: () => void;
  setSelectedCustomer: (customer: { id: number; nameAr: string; phone: string } | null) => void;
  holdCart: () => void;
  resumeCart: (index: number) => void;
  removeHeldCart: (index: number) => void;
  setDiscount: (discount: number) => void;
  setPaymentMethod: (method: string) => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  cart: [],
  selectedCustomer: null,
  heldCarts: [],
  discount: 0,
  paymentMethod: 'cash',

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.productId === item.productId);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.productId === item.productId
              ? { ...c, quantity: c.quantity + item.quantity }
              : c
          ),
        };
      }
      return { cart: [...state.cart, item] };
    }),

  removeFromCart: (productId) =>
    set((state) => ({ cart: state.cart.filter((c) => c.productId !== productId) })),

  updateQuantity: (productId, quantity) =>
    set((state) => ({
      cart: state.cart.map((c) =>
        c.productId === productId ? { ...c, quantity } : c
      ),
    })),

  updateDiscount: (productId, discount) =>
    set((state) => ({
      cart: state.cart.map((c) =>
        c.productId === productId ? { ...c, discount } : c
      ),
    })),

  clearCart: () => set({ cart: [], discount: 0 }),

  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),

  holdCart: () =>
    set((state) => ({
      heldCarts: [...state.heldCarts, state.cart],
      cart: [],
      discount: 0,
    })),

  resumeCart: (index) =>
    set((state) => ({
      cart: state.heldCarts[index],
      heldCarts: state.heldCarts.filter((_, i) => i !== index),
      discount: 0,
    })),

  removeHeldCart: (index) =>
    set((state) => ({
      heldCarts: state.heldCarts.filter((_, i) => i !== index),
    })),

  setDiscount: (discount) => set({ discount }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  getSubtotal: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  },

  getTotal: () => {
    const { discount } = get();
    const subtotal = get().getSubtotal();
    return Math.max(0, subtotal - discount);
  },
}));
