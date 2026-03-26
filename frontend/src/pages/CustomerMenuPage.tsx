import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Minus, Plus, ShoppingCart, User } from 'lucide-react';
import { customerService, foodService, orderService } from '../services/api';
import { FoodItem } from '../types/customer';
import {
  detectFaceWithExpression,
  loadModels,
  startWebcam,
  stopWebcam,
} from '../utils/faceDetection';

const categories: Array<FoodItem['category'] | 'all'> = [
  'all',
  'appetizer',
  'main',
  'dessert',
  'beverage',
  'side',
  'special',
];

type RecognizedCustomer = {
  id: string;
  name: string;
  preferences: string[];
  dietaryRestrictions: string[];
};

const CUSTOMER_RECOGNITION_INTERVAL = 2200;

const CustomerMenuPage: React.FC = () => {
  const metallicCardClass =
    'rounded-2xl border border-slate-500/35 bg-[linear-gradient(135deg,rgba(148,163,184,0.18)_0%,rgba(30,41,59,0.55)_35%,rgba(15,23,42,0.85)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(148,163,184,0.18),0_14px_30px_rgba(2,6,23,0.45)] backdrop-blur-sm';

  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [, setTrackingState] = useState<'initializing' | 'active' | 'blocked'>('initializing');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [recognizedCustomer, setRecognizedCustomer] = useState<RecognizedCustomer | null>(null);
  const [personalizedItems, setPersonalizedItems] = useState<FoodItem[]>([]);
  const trackingVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        setLoading(true);
        const response = await foodService.getAllFoodItems({ isAvailable: true });
        setItems(response.data.foodItems || []);
      } catch (error: any) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load menu' });
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, []);

  useEffect(() => {
    const startAutoTracking = async () => {
      try {
        await loadModels({ preferHighAccuracy: true });

        if (!trackingVideoRef.current) {
          setTrackingState('blocked');
          return;
        }

        const stream = await startWebcam(trackingVideoRef.current);
        streamRef.current = stream;
        setTrackingState('active');

        trackingIntervalRef.current = window.setInterval(async () => {
          if (!trackingVideoRef.current || trackingVideoRef.current.readyState !== 4) {
            return;
          }

          const detection = await detectFaceWithExpression(trackingVideoRef.current, {
            highAccuracy: true,
          });

          if (!detection) {
            return;
          }

          if (!recognizedCustomer) {
            try {
              const response = await customerService.recognizeCustomer(Array.from(detection.descriptor));
              const data = response.data;
              if (data?.customer?.id) {
                setRecognizedCustomer({
                  id: data.customer.id,
                  name: data.customer.name,
                  preferences: data.customer.preferences || [],
                  dietaryRestrictions: data.customer.dietaryRestrictions || [],
                });
              }
            } catch {}
          }
        }, CUSTOMER_RECOGNITION_INTERVAL);
      } catch {
        setTrackingState('blocked');
      }
    };

    startAutoTracking();

    return () => {
      if (trackingIntervalRef.current) {
        window.clearInterval(trackingIntervalRef.current);
      }
      stopWebcam(streamRef.current);
      streamRef.current = null;
    };
  }, [recognizedCustomer]);

  useEffect(() => {
    if (!recognizedCustomer) {
      setPersonalizedItems([]);
      return;
    }

    const applyPersonalization = async () => {
      try {
        const response = await customerService.getRecommendations(recognizedCustomer.id, 'neutral');
        const recommendations = response.data.recommendations as FoodItem[];
        if (recommendations?.length) {
          setPersonalizedItems(recommendations);
        } else {
          setPersonalizedItems([]);
        }
      } catch {
        setPersonalizedItems([]);
      }
    };

    applyPersonalization();
  }, [recognizedCustomer]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') {
      return items;
    }
    return items.filter((item) => item.category === activeCategory);
  }, [items, activeCategory]);

  const cartItems = useMemo(() => {
    const selected = Array.from(cart.entries()).map(([id, quantity]) => {
      const item = items.find((food) => food._id === id);
      return item ? { item, quantity } : null;
    });

    return selected.filter(Boolean) as Array<{ item: FoodItem; quantity: number }>;
  }, [cart, items]);

  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, row) => sum + row.item.price * row.quantity, 0).toFixed(2);
  }, [cartItems]);

  const updateCart = (foodId: string, delta: number) => {
    setCart((current) => {
      const next = new Map(current);
      const existing = next.get(foodId) || 0;
      const updated = Math.max(0, existing + delta);
      if (updated === 0) {
        next.delete(foodId);
      } else {
        next.set(foodId, updated);
      }
      return next;
    });
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one item to cart' });
      return;
    }

    try {
      setPlacingOrder(true);
      setMessage({ type: '', text: '' });

      const payloadItems = cartItems.map((row) => ({
        foodItemId: row.item._id,
        quantity: row.quantity,
      }));

      await orderService.createOrder({
        customerId: recognizedCustomer?.id,
        items: payloadItems,
      });

      setMessage({
        type: 'success',
        text: recognizedCustomer?.name
          ? `Order placed successfully for ${recognizedCustomer.name}.`
          : 'Order placed successfully.',
      });
      setCart(new Map());
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to place order' });
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100"
      style={{ fontFamily: 'BebasNeue, sans-serif' }}
    >
      <div className="absolute inset-0 bg-black" />
      <div className="relative z-10 mx-auto w-full max-w-[86rem] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/40 backdrop-blur-sm">
          <video
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          >
            <source src="/assets/japanese-restaurants-night-street-love-money-rocknroll-moewalls-com.mp4" type="video/mp4" />
          </video>
          <div className="pointer-events-none absolute inset-0 bg-slate-950/60" />
          <div className="relative z-10 flex items-center justify-between px-6 py-5">
            <div>
              <p className="text-sm font-semibold tracking-wider text-blue-300">VisionBite</p>
              <h1 className="text-3xl font-bold tracking-[0.08em] text-white" style={{ fontFamily: 'Bungee, sans-serif' }}>
                Customer Menu
              </h1>
              <p className="text-sm tracking-wide text-slate-400">Scan complete menu & order</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-200">
              <User size={16} />
              {recognizedCustomer?.name || 'Guest'}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[86rem] px-4 py-6 sm:px-6 lg:px-8">
        <section>
          {recognizedCustomer && personalizedItems.length > 0 && (
            <div className="mb-4 rounded-2xl border border-emerald-400/35 bg-transparent p-4 shadow-xl shadow-slate-950/30">
              <h2 className="text-2xl font-semibold tracking-wide text-emerald-100">
                Personalized picks for {recognizedCustomer.name}
              </h2>
              <p className="text-sm tracking-wide text-emerald-200">Based on your past visits and preferences.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {personalizedItems.slice(0, 4).map((item) => (
                  <div key={item._id} className="rounded-lg border border-emerald-400/20 bg-transparent p-3">
                    <p className="font-semibold text-slate-100">{item.name}</p>
                    <p className="text-sm text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className={`${metallicCardClass} p-4 lg:col-span-4`}>
              <h2 className="text-2xl font-semibold tracking-wide text-white">Browse Menu</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                      activeCategory === category
                        ? 'bg-blue-500 text-white'
                        : 'border border-slate-700/60 bg-transparent text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 lg:col-span-1">
              <div className={`${metallicCardClass} p-4`}>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold tracking-wide text-white">
                  <ShoppingCart size={18} />
                  Your Cart
                </h2>

                {cartItems.length === 0 ? (
                  <p className="text-sm text-slate-400">No items selected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {cartItems.map((row) => (
                      <div key={row.item._id} className="flex items-center justify-between text-sm">
                        <p className="max-w-[65%] truncate text-slate-200">{row.item.name} x {row.quantity}</p>
                        <p className="font-semibold text-slate-100">${(row.item.price * row.quantity).toFixed(2)}</p>
                      </div>
                    ))}

                    <div className="mt-3 border-t border-slate-700/70 pt-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-semibold text-slate-100">Total</span>
                        <span className="text-xl font-bold text-blue-300">${totalAmount}</span>
                      </div>

                      <button
                        type="button"
                        disabled={placingOrder || cartItems.length === 0}
                        onClick={handlePlaceOrder}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                      >
                        <Camera size={18} />
                        {placingOrder ? 'Placing Order...' : 'Place Order'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {message.text && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    message.type === 'success'
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                      : 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-700/60 bg-transparent p-8 text-center text-slate-300">
              Loading menu...
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredItems.map((item) => (
                <article key={item._id} className="rounded-2xl border border-slate-700/60 bg-transparent p-4 shadow-xl shadow-slate-950/30">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-[0.1em] text-slate-100">{item.name}</h3>
                    <span className="text-xl font-bold tracking-wide text-blue-300">${item.price.toFixed(2)}</span>
                  </div>

                  <p className="mb-3 text-base tracking-wide text-slate-300">{item.description}</p>

                  <div className="mb-3 flex flex-wrap gap-1">
                    <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">{item.category}</span>
                    {item.isVegetarian && (
                      <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">Vegetarian</span>
                    )}
                    {item.isVegan && <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">Vegan</span>}
                    {item.isGlutenFree && (
                      <span className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200">Gluten-Free</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700/70 px-2 py-1">
                      <button
                        type="button"
                        onClick={() => updateCart(item._id, -1)}
                        className="rounded p-1 text-slate-200 hover:bg-slate-800"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-slate-100">
                        {cart.get(item._id) || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCart(item._id, 1)}
                        className="rounded p-1 text-slate-200 hover:bg-slate-800"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <video ref={trackingVideoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
};

export default CustomerMenuPage;