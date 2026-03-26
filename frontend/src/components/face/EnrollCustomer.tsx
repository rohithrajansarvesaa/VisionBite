import React, { useState } from 'react';
import { UserPlus, Camera } from 'lucide-react';
import WebcamCapture from './WebcamCapture';
import { customerService } from '../../services/api';

const EnrollCustomer: React.FC = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    preferences: [] as string[],
    dietaryRestrictions: [] as string[],
  });
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);

  const categories = ['appetizer', 'main', 'dessert', 'beverage', 'side', 'special'];
  const restrictions = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePreferenceToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences.includes(category)
        ? prev.preferences.filter(p => p !== category)
        : [...prev.preferences, category],
    }));
  };

  const handleRestrictionToggle = (restriction: string) => {
    setFormData(prev => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(restriction)
        ? prev.dietaryRestrictions.filter(r => r !== restriction)
        : [...prev.dietaryRestrictions, restriction],
    }));
  };

  const handleFaceCapture = (descriptor: number[], emotion: string) => {
    setFaceDescriptor(descriptor);
    setShowCamera(false);
    setMessage({ type: 'success', text: `Face captured successfully! Detected emotion: ${emotion}` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      setMessage({ type: 'error', text: 'Please enter customer name' });
      return;
    }

    if (!formData.phone || !formData.email) {
      setMessage({ type: 'error', text: 'Phone and email are required' });
      return;
    }

    if (!faceDescriptor) {
      setMessage({ type: 'error', text: 'Please capture face first' });
      return;
    }

    try {
      setCapturing(true);
      await customerService.enrollCustomer({
        ...formData,
        faceDescriptor,
      });

      setMessage({ type: 'success', text: 'Customer enrolled successfully!' });
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        email: '',
        preferences: [],
        dietaryRestrictions: [],
      });
      setFaceDescriptor(null);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to enroll customer',
      });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-500/30 bg-transparent p-6 shadow-xl shadow-slate-950/10 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="text-blue-300" size={28} />
        <h2 className="text-4xl font-bold text-white">Enroll New Customer</h2>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-100'
              : 'border border-rose-400/35 bg-rose-500/20 text-rose-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-base font-medium text-slate-300">
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-600/70 bg-slate-900/60 px-4 py-2 text-slate-100 focus:border-blue-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-base font-medium text-slate-300">
              Phone *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-600/70 bg-slate-900/60 px-4 py-2 text-slate-100 focus:border-blue-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-base font-medium text-slate-300">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-600/70 bg-slate-900/60 px-4 py-2 text-slate-100 focus:border-blue-400 focus:outline-none"
              required
            />
          </div>

        </div>

        {/* Food Preferences */}
        <div>
          <label className="mb-2 block text-base font-medium text-slate-300">
            Food Preferences
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                type="button"
                onClick={() => handlePreferenceToggle(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  formData.preferences.includes(category)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Dietary Restrictions */}
        <div>
          <label className="mb-2 block text-base font-medium text-slate-300">
            Dietary Restrictions
          </label>
          <div className="flex flex-wrap gap-2">
            {restrictions.map(restriction => (
              <button
                key={restriction}
                type="button"
                onClick={() => handleRestrictionToggle(restriction)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  formData.dietaryRestrictions.includes(restriction)
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {restriction.charAt(0).toUpperCase() + restriction.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Face Capture */}
        <div>
          <label className="mb-2 block text-base font-medium text-slate-300">
            Face Recognition *
          </label>
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold ${
              faceDescriptor
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Camera size={20} />
            {faceDescriptor ? '✓ Face Captured - Recapture?' : 'Capture Face'}
          </button>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={capturing || !faceDescriptor}
            className={`flex-1 md:flex-none px-8 py-3 rounded-lg font-semibold ${
              capturing || !faceDescriptor
                ? 'cursor-not-allowed bg-slate-700 text-slate-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {capturing ? 'Enrolling...' : 'Enroll Customer'}
          </button>
        </div>
      </form>

      {showCamera && (
        <WebcamCapture
          title="Capture Customer Face"
          onCapture={handleFaceCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default EnrollCustomer;
