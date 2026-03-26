import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Minus, Plus, ShoppingCart, Sparkles, User } from 'lucide-react';
import { customerService, foodService, orderService } from '../services/api';
import { FoodItem } from '../types/customer';
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

type RecognizedCustomer = {
  id: string;
  name: string;
  preferences: string[];
  dietaryRestrictions: string[];
};

const CUSTOMER_RECOGNITION_INTERVAL = 2200;

const CustomerMenuPage: React.FC = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [trackingState, setTrackingState] = useState<'initializing' | 'active' | 'blocked'>('initializing');
  const [dominantEmotion, setDominantEmotion] = useState<string>('neutral');
  const [emotionCounts, setEmotionCounts] = useState<Record<string, number>>({});
  const [placingOrder, setPlacingOrder] = useState(false);
  const [recognizedCustomer, setRecognizedCustomer] = useState<RecognizedCustomer | null>(null);
  const [personalizedItems, setPersonalizedItems] = useState<FoodItem[]>([]);
  const [recognitionStatus, setRecognitionStatus] = useState('Detecting face...');

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
            setRecognitionStatus('Face not detected');
            return;
          }

          setRecognitionStatus('Face detected. Identifying...');

          const emotion = getDominantEmotion(detection.expressions);
          setEmotionCounts((current) => {
            const next = {
              ...current,
              [emotion]: (current[emotion] || 0) + 1,
            };
            setDominantEmotion(computeDominantEmotion(next));
            return next;
          });

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
                setRecognitionStatus(`Welcome back, ${data.customer.name}`);
              } else {
                setRecognitionStatus('Customer not recognized');
              }
            } catch {
              setRecognitionStatus('Customer not recognized');
            }
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

    if (!recognizedCustomer?.id) {
      setMessage({
        type: 'error',
        text: 'We could not identify you yet. Please stand in front of the camera and try again.',
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
        customerId: recognizedCustomer.id,
        items: payloadItems,
      });

      setMessage({
        type: 'success',
        text: `Order placed successfully for ${recognizedCustomer.name}.`,
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
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
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

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
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

          <div className="mb-4 rounded-2xl border border-slate-700/60 bg-transparent p-4 shadow-xl shadow-slate-950/30">
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

          {loading ? (
            <div className="rounded-2xl border border-slate-700/60 bg-transparent p-8 text-center text-slate-300">
              Loading menu...
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-700/60 bg-transparent p-4 shadow-xl shadow-slate-950/30">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold tracking-wide text-white">
              <Camera size={18} />
              Arrival Face Check
            </h2>
            <div className="mt-3 rounded-lg border border-slate-700/70 bg-transparent p-3 text-sm">
              <p className="font-semibold text-slate-300">Status</p>
              <p className="mt-1 text-slate-200">{recognitionStatus}</p>
              <p className="mt-2 text-xs text-slate-400">
                This camera is used only to identify you and personalize the menu.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-transparent p-4 shadow-xl shadow-slate-950/30">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold tracking-wide text-white">
              <Camera size={18} />
              Emotion Monitoring
            </h2>
            <div className="mt-3 rounded-lg border border-slate-700/70 bg-transparent p-3 text-sm">
              <p className="font-semibold text-slate-300">Tracking status</p>
              <p className="mt-1 text-slate-200">
                {trackingState === 'active'
                  ? 'Active (background monitoring)'
                  : trackingState === 'initializing'
                  ? 'Initializing camera...'
                  : 'Blocked (camera permission denied)'}
              </p>
              <p className="mt-2 font-semibold text-slate-300">Dominant emotion (session)</p>
              <p className="mt-1 text-slate-100 capitalize">{dominantEmotion}</p>
              <p className="mt-2 text-xs text-slate-400">
                Emotion data is stored for future personalization and does not affect the current order.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-transparent p-4 shadow-xl shadow-slate-950/30">
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

          <div className="rounded-2xl border border-slate-700/60 bg-transparent p-4 shadow-xl shadow-slate-950/30">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              <Sparkles size={14} />
              Personalized Experience
            </h3>
            <p className="text-sm text-slate-300">
              We identify you on entry and keep a background emotion log for future recommendations.
            </p>
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
        </aside>
      </div>

      <video ref={trackingVideoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
};

export default CustomerMenuPage;