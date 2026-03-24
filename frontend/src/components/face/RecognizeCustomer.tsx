import React, { useMemo, useState } from 'react';
import { Scan, History, Users } from 'lucide-react';
import GroupWebcamCapture from './GroupWebcamCapture';
import { customerService } from '../../services/api';
import { FaceRecognitionResult, FoodItem, GroupFaceRecognitionResponse } from '../../types/customer';

interface CapturedFaceInput {
  descriptor: number[];
  emotion: string;
}

interface GroupRecognitionCard {
  recognition: FaceRecognitionResult;
  detectedMood: string;
  recommendations: FoodItem[];
}

interface UnknownFace {
  index: number;
  descriptor: number[];
  emotion: string;
}

interface UnknownFaceForm {
  name: string;
  phone: string;
  email: string;
  isSaving: boolean;
}

const RecognizeCustomer: React.FC = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [hasNewEnrollments, setHasNewEnrollments] = useState(false);
  const [groupResults, setGroupResults] = useState<GroupRecognitionCard[]>([]);
  const [unknownFaces, setUnknownFaces] = useState<UnknownFace[]>([]);
  const [unknownFaceForms, setUnknownFaceForms] = useState<Record<number, UnknownFaceForm>>({});
  const [message, setMessage] = useState({ type: '', text: '' });

  const getFaceEmotionByIndex = (faces: CapturedFaceInput[], index?: number) => {
    if (typeof index === 'number' && faces[index]) {
      return faces[index].emotion || 'neutral';
    }
    return 'neutral';
  };

  const getInitialUnknownFaceForms = (faces: UnknownFace[]) => {
    const forms: Record<number, UnknownFaceForm> = {};
    for (const face of faces) {
      forms[face.index] = {
        name: '',
        phone: '',
        email: '',
        isSaving: false,
      };
    }
    return forms;
  };

  const updateUnknownForm = (index: number, updates: Partial<UnknownFaceForm>) => {
    setUnknownFaceForms((current) => ({
      ...current,
      [index]: {
        ...(current[index] || { name: '', phone: '', email: '', isSaving: false }),
        ...updates,
      },
    }));
  };

  const handleGroupCapture = async (faces: CapturedFaceInput[]) => {
    setShowCamera(false);
    setRecognizing(true);
    setHasNewEnrollments(false);
    setMessage({ type: '', text: '' });
    setGroupResults([]);
    setUnknownFaces([]);
    setUnknownFaceForms({});

    try {
      const batchResponse = await customerService.recognizeCustomersBatch(faces.map((face) => face.descriptor));
      const data = batchResponse.data as GroupFaceRecognitionResponse;
      const recognizedResults = data.results as FaceRecognitionResult[];

      const unmatchedIndices = data.unmatchedDescriptorIndices || [];
      const unmatchedFaces = unmatchedIndices
        .filter((index) => index >= 0 && index < faces.length)
        .map((index) => ({
          index,
          descriptor: faces[index].descriptor,
          emotion: faces[index].emotion,
        }));

      setUnknownFaces(unmatchedFaces);
      setUnknownFaceForms(getInitialUnknownFaceForms(unmatchedFaces));

      if (recognizedResults.length === 0) {
        setMessage({
          type: 'warning',
          text: `No enrolled customers recognized from this group. ${unmatchedFaces.length} face(s) can be enrolled below.`,
        });
        return;
      }

      const cards = await Promise.all(
        recognizedResults.map(async (result) => {
          const detectedMood = getFaceEmotionByIndex(faces, result.matchedDescriptorIndex);
          const recResponse = await customerService.getRecommendations(result.customer.id, detectedMood);
          return {
            recognition: result,
            detectedMood,
            recommendations: recResponse.data.recommendations as FoodItem[],
          } as GroupRecognitionCard;
        })
      );

      setGroupResults(cards);
      setMessage({
        type: 'success',
        text: `Detected ${faces.length} face(s). Recognized ${data.recognizedCount} customer(s), ${data.unrecognizedCount} not recognized.`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Group recognition failed',
      });
    } finally {
      setRecognizing(false);
    }
  };

  const handleEnrollUnknownFace = async (unknownFace: UnknownFace) => {
    const form = unknownFaceForms[unknownFace.index];
    if (!form?.name?.trim()) {
      setMessage({
        type: 'error',
        text: `Please enter a name for Face #${unknownFace.index + 1}`,
      });
      return;
    }

    try {
      updateUnknownForm(unknownFace.index, { isSaving: true });
      await customerService.enrollCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        preferences: [],
        dietaryRestrictions: [],
        faceDescriptor: unknownFace.descriptor,
      });

      setUnknownFaces((current) => current.filter((face) => face.index !== unknownFace.index));
      setUnknownFaceForms((current) => {
        const next = { ...current };
        delete next[unknownFace.index];
        return next;
      });

      setMessage({
        type: 'success',
        text: `Face #${unknownFace.index + 1} enrolled successfully. Run group scan again to include them in recommendations.`,
      });
      setHasNewEnrollments(true);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || `Failed to enroll Face #${unknownFace.index + 1}`,
      });
    } finally {
      updateUnknownForm(unknownFace.index, { isSaving: false });
    }
  };

  const handleRescanNow = () => {
    setMessage({ type: '', text: '' });
    setShowCamera(true);
  };

  const totalRecognized = useMemo(() => groupResults.length, [groupResults.length]);

  return (
    <div className="space-y-6">
      {/* Recognition Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Scan className="text-purple-500" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">Recognize Group Customers</h2>
        </div>

        {message.text && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 border border-green-400 text-green-700'
                : message.type === 'warning'
                ? 'bg-yellow-100 border border-yellow-400 text-yellow-700'
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          onClick={() => setShowCamera(true)}
          disabled={recognizing}
          className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold disabled:bg-gray-300"
        >
          <Users size={20} />
          {recognizing ? 'Recognizing Group...' : 'Start Group Recognition'}
        </button>

        {hasNewEnrollments && (
          <button
            type="button"
            onClick={handleRescanNow}
            className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            <Scan size={20} />
            Rescan Now
          </button>
        )}

        {totalRecognized > 0 && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Recognized customers in current scan: {totalRecognized}
          </div>
        )}
      </div>

      {groupResults.map((card) => (
        <div key={card.recognition.customer.id} className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 text-lg font-semibold">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {card.recognition.customer.name}</p>
                <p><strong>Visits:</strong> {card.recognition.customer.visitCount}</p>
                <p><strong>Detected Mood:</strong> <span className="capitalize">{card.detectedMood}</span></p>
                <p>
                  <strong>Match:</strong>{' '}
                  {(parseFloat(card.recognition.matchConfidence) * 100).toFixed(0)}%
                  {typeof card.recognition.matchDistance === 'number'
                    ? ` (distance ${card.recognition.matchDistance})`
                    : ''}
                </p>
                {card.recognition.customer.phone && (
                  <p><strong>Phone:</strong> {card.recognition.customer.phone}</p>
                )}
                {card.recognition.customer.email && (
                  <p><strong>Email:</strong> {card.recognition.customer.email}</p>
                )}
                {card.recognition.customer.dietaryRestrictions.length > 0 && (
                  <p>
                    <strong>Restrictions:</strong>{' '}
                    {card.recognition.customer.dietaryRestrictions.join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <History size={20} />
                Recent Orders
              </h3>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {card.recognition.orderHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No previous orders</p>
                ) : (
                  card.recognition.orderHistory.slice(0, 5).map((order) => (
                    <div key={order._id} className="border-b pb-2 text-sm">
                      <p className="font-medium">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-gray-600">
                        {order.items.length} items - ${order.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-xl font-bold text-gray-800">
              Personalized Recommendations for {card.recognition.customer.name}
              <span className="ml-2 text-sm font-normal text-gray-500">
                Based on mood: <span className="font-semibold capitalize">{card.detectedMood}</span>
              </span>
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {card.recommendations.map((item) => (
                <div key={item._id} className="rounded-lg border border-gray-200 p-4 transition hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between">
                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                    <span className="text-lg font-bold text-blue-600">${item.price}</span>
                  </div>
                  <p className="mb-2 text-sm text-gray-600">{item.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs">{item.category}</span>
                    {item.isVegetarian && (
                      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Vegetarian</span>
                    )}
                    {item.spicyLevel > 0 && (
                      <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">🌶️ {item.spicyLevel}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {unknownFaces.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-xl font-bold text-gray-800">Unknown Faces Detected</h3>
          <p className="mb-4 text-sm text-gray-600">
            Enroll these customers now so the next scan can fetch their order history and recommendations.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {unknownFaces.map((unknownFace) => {
              const form = unknownFaceForms[unknownFace.index] || {
                name: '',
                phone: '',
                email: '',
                isSaving: false,
              };

              return (
                <div key={unknownFace.index} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold text-amber-900">Face #{unknownFace.index + 1}</h4>
                    <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      Mood: {unknownFace.emotion}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Customer name"
                      value={form.name}
                      onChange={(event) => updateUnknownForm(unknownFace.index, { name: event.target.value })}
                      className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phone (optional)"
                      value={form.phone}
                      onChange={(event) => updateUnknownForm(unknownFace.index, { phone: event.target.value })}
                      className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={form.email}
                      onChange={(event) => updateUnknownForm(unknownFace.index, { email: event.target.value })}
                      className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={form.isSaving}
                      onClick={() => handleEnrollUnknownFace(unknownFace)}
                      className="w-full rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {form.isSaving ? 'Enrolling...' : 'Enroll This Customer'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCamera && (
        <GroupWebcamCapture
          title="Scan Group Faces"
          onCapture={handleGroupCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default RecognizeCustomer;
