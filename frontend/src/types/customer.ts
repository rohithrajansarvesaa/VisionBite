export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  preferences: string[];
  dietaryRestrictions: string[];
  visitCount: number;
  lastVisit: Date;
}

export interface FoodItem {
  _id: string;
  name: string;
  category: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side' | 'special';
  description: string;
  price: number;
  image?: string;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spicyLevel: number;
  moodTags: string[];
  isAvailable: boolean;
  recommendationScore?: number;
}

export interface OrderItem {
  foodItem: FoodItem;
  quantity: number;
  price: number;
}

export interface Order {
  _id: string;
  customer: Customer;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  detectedMood?: string;
  notes?: string;
  servedBy: any;
  createdAt: Date;
}

export interface FaceRecognitionResult {
  customer: Customer;
  matchConfidence: string;
  matchDistance?: number;
  matchedDescriptorIndex?: number;
  orderHistory: Order[];
  isNewCustomer?: boolean;
}

export interface GroupFaceRecognitionResponse {
  message: string;
  recognizedCount: number;
  unrecognizedCount: number;
  matchedDescriptorIndices?: number[];
  unmatchedDescriptorIndices?: number[];
  thresholdUsed: number;
  results: FaceRecognitionResult[];
}
