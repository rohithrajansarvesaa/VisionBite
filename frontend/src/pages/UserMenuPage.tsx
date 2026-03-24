import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, Minus, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { foodService, orderService } from '../services/api';
import { FoodItem, Order } from '../types/customer';
import {
  detectFaceWithExpression,
  getDominantEmotion,
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

const UserMenuPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [trackingState, setTrackingState] = useState<'initializing' | 'active' | 'blocked'>('initializing');
  const [dominantEmotion, setDominantEmotion] = useState<string>('neutral');
  const [emotionCounts, setEmotionCounts] = useState<Record<string, number>>({});
  const [moodHistoryOrders, setMoodHistoryOrders] = useState<Order[]>([]);
  const [similarProducts, setSimilarProducts] = useState<FoodItem[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const trackingVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);

  const computeDominantEmotion = (counts: Record<string, number>) => {
    const entries = Object.entries(counts);
    if (entries.length === 0) {
      return 'neutral';
    }
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

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
        await loadModels();

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
            highAccuracy: false,
          });

          if (!detection) {
            return;
          }

          const emotion = getDominantEmotion(detection.expressions);
          setEmotionCounts((current) => {
            const next = {
              ...current,
              [emotion]: (current[emotion] || 0) + 1,
            };
            setDominantEmotion(computeDominantEmotion(next));
            return next;
          });
        }, 1800);
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
  }, []);

  useEffect(() => {
    const loadMoodHistory = async () => {
      if (trackingState !== 'active') {
        return;
      }

      try {
        const response = await orderService.getMoodInsights(dominantEmotion);
        setMoodHistoryOrders((response.data?.pastOrders || []) as Order[]);
        setSimilarProducts((response.data?.similarProducts || []) as FoodItem[]);
      } catch {
        setMoodHistoryOrders([]);
        setSimilarProducts([]);
      }
    };

    loadMoodHistory();
  }, [dominantEmotion, trackingState]);

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

    if (trackingState !== 'active') {
      setMessage({
        type: 'error',
        text: 'Emotion tracking camera is not active. Please allow camera access and refresh.',
      });
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
        items: payloadItems,
        detectedMood: dominantEmotion,
      });

      setMessage({
        type: 'success',
        text: `Order placed successfully with dominant tracked emotion: ${dominantEmotion}`,
      });
      setCart(new Map());
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to place order' });
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">VisionBite</p>
            <h1 className="text-2xl font-bold text-slate-900">Menu & Orders</h1>
            <p className="text-sm text-slate-500">Hello, {user?.name || 'Guest'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Browse Menu</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    activeCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading menu...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <article key={item._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    <span className="text-lg font-bold text-blue-600">${item.price.toFixed(2)}</span>
                  </div>

                  <p className="mb-3 text-sm text-slate-600">{item.description}</p>

                  <div className="mb-3 flex flex-wrap gap-1">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{item.category}</span>
                    {item.isVegetarian && <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Vegetarian</span>}
                    {item.isVegan && <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Vegan</span>}
                    {item.isGlutenFree && <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">Gluten-Free</span>}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-1">
                      <button
                        type="button"
                        onClick={() => updateCart(item._id, -1)}
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-slate-900">{cart.get(item._id) || 0}</span>
                      <button
                        type="button"
                        onClick={() => updateCart(item._id, 1)}
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
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

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Camera size={18} />
              Customer Emotion Camera
            </h2>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-700">Tracking status</p>
              <p className="mt-1 text-slate-600">
                {trackingState === 'active'
                  ? 'Active (webcam CCTV simulation)'
                  : trackingState === 'initializing'
                  ? 'Initializing camera...'
                  : 'Blocked (camera permission denied)'}
              </p>
              <p className="mt-2 font-semibold text-slate-700">Dominant emotion (session)</p>
              <p className="mt-1 text-slate-600 capitalize">{dominantEmotion}</p>
              <p className="mt-2 text-xs text-slate-500">
                Emotion samples captured: {Object.values(emotionCounts).reduce((sum, value) => sum + value, 0)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <ShoppingCart size={18} />
              Your Cart
            </h2>

            {cartItems.length === 0 ? (
              <p className="text-sm text-slate-500">No items selected yet.</p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((row) => (
                  <div key={row.item._id} className="flex items-center justify-between text-sm">
                    <p className="max-w-[65%] truncate text-slate-700">{row.item.name} x {row.quantity}</p>
                    <p className="font-semibold text-slate-900">${(row.item.price * row.quantity).toFixed(2)}</p>
                  </div>
                ))}

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="text-xl font-bold text-blue-700">${totalAmount}</span>
                  </div>

                  <button
                    type="button"
                    disabled={placingOrder || cartItems.length === 0}
                    onClick={handlePlaceOrder}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Camera size={18} />
                    {placingOrder ? 'Placing Order...' : 'Place Order with Captured Emotion'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              <Sparkles size={14} />
              Emotion-based Ordering
            </h3>
            <p className="text-sm text-slate-600">
              Emotion is tracked continuously in the background while viewing menu (CCTV simulation with webcam). Dominant session emotion is stored on order placement.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Past Orders For Current Emotion
            </h3>
            {moodHistoryOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No previous orders for emotion: {dominantEmotion}</p>
            ) : (
              <div className="space-y-2">
                {moodHistoryOrders.slice(0, 4).map((order) => (
                  <div key={order._id} className="rounded border border-slate-200 p-2 text-sm">
                    <p className="font-medium text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</p>
                    <p className="text-slate-600">{order.items.length} items - ${order.totalAmount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Similar Products For {dominantEmotion}
            </h3>
            {similarProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No similar products yet. Place more orders to personalize.</p>
            ) : (
              <div className="space-y-2">
                {similarProducts.map((item) => (
                  <div key={item._id} className="rounded border border-slate-200 p-2 text-sm">
                    <p className="font-medium text-slate-700">{item.name}</p>
                    <p className="text-slate-600">${item.price.toFixed(2)} • {item.category}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message.text && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-rose-300 bg-rose-50 text-rose-800'
              }`}
            >
              {message.text}
            </div>
          )}
        </aside>
      </div>

      <video ref={trackingVideoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
};

export default UserMenuPage;
