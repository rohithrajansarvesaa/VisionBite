import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import FoodItem from '../models/FoodItem.js';

const FACE_RECOGNITION_THRESHOLD = Number(process.env.FACE_RECOGNITION_THRESHOLD ?? 0.58);

const getBestCustomerMatch = (incomingDescriptor, customers) => {
  let bestMatch = null;
  let minDistance = Infinity;

  for (const customer of customers) {
    const distance = euclideanDistance(incomingDescriptor, customer.faceDescriptor);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = customer;
    }
  }

  if (!bestMatch || minDistance >= FACE_RECOGNITION_THRESHOLD) {
    return null;
  }

  return {
    customer: bestMatch,
    distance: minDistance,
  };
};

// Enroll a new customer with face descriptor
export const enrollCustomer = async (req, res) => {
  try {
    const { name, phone, email, faceDescriptor, preferences, dietaryRestrictions } = req.body;

    if (!name || !phone || !email || !faceDescriptor || faceDescriptor.length !== 128) {
      return res.status(400).json({ 
        message: 'Name, phone, email and valid face descriptor (128 dimensions) are required' 
      });
    }

    // Check if customer already exists by name
    const existingCustomer = await Customer.findOne({ name });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer already enrolled' });
    }

    const customer = await Customer.create({
      name,
      phone,
      email,
      faceDescriptor,
      preferences: preferences || [],
      dietaryRestrictions: dietaryRestrictions || [],
      enrolledBy: req.user.id,
    });

    res.status(201).json({
      message: 'Customer enrolled successfully',
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all enrolled customers
export const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('-faceDescriptor')
      .populate('enrolledBy', 'name')
      .sort('-createdAt');

    res.status(200).json({
      count: customers.length,
      customers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Recognize customer by face descriptor
export const recognizeCustomer = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;

    if (!faceDescriptor || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Valid face descriptor required' });
    }

    // Get all customers with their face descriptors
    const customers = await Customer.find();

    if (customers.length === 0) {
      return res.status(404).json({ message: 'No customers enrolled yet' });
    }

    // Find best match using Euclidean distance
    const bestResult = getBestCustomerMatch(faceDescriptor, customers);

    if (!bestResult) {
      return res.status(404).json({ 
        message: 'Customer not recognized',
        isNewCustomer: true 
      });
    }

    const { customer: bestMatch, distance: minDistance } = bestResult;

    // Update last visit and visit count
    bestMatch.lastVisit = new Date();
    bestMatch.visitCount += 1;
    await bestMatch.save();

    // Get customer's order history
    const orders = await Order.find({ customer: bestMatch._id })
      .populate('items.foodItem')
      .sort('-createdAt')
      .limit(10);

    res.status(200).json({
      message: 'Customer recognized',
      customer: {
        id: bestMatch._id,
        name: bestMatch.name,
        phone: bestMatch.phone,
        email: bestMatch.email,
        preferences: bestMatch.preferences,
        dietaryRestrictions: bestMatch.dietaryRestrictions,
        visitCount: bestMatch.visitCount,
        lastVisit: bestMatch.lastVisit,
      },
      matchConfidence: (1 - minDistance).toFixed(2),
      matchDistance: Number(minDistance.toFixed(4)),
      thresholdUsed: FACE_RECOGNITION_THRESHOLD,
      orderHistory: orders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const matchCustomer = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;

    if (!faceDescriptor || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Valid face descriptor required' });
    }

    const customers = await Customer.find();

    if (customers.length === 0) {
      return res.status(200).json({
        message: 'No customers enrolled yet',
        matched: false,
        thresholdUsed: FACE_RECOGNITION_THRESHOLD,
      });
    }

    const bestResult = getBestCustomerMatch(faceDescriptor, customers);

    if (!bestResult) {
      return res.status(200).json({
        message: 'Customer not matched',
        matched: false,
        thresholdUsed: FACE_RECOGNITION_THRESHOLD,
      });
    }

    const { customer, distance } = bestResult;

    return res.status(200).json({
      message: 'Customer matched',
      matched: true,
      customer: {
        id: customer._id,
        name: customer.name,
      },
      matchConfidence: (1 - distance).toFixed(2),
      matchDistance: Number(distance.toFixed(4)),
      thresholdUsed: FACE_RECOGNITION_THRESHOLD,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const matchCustomersBatch = async (req, res) => {
  try {
    const { faceDescriptors } = req.body;

    if (!Array.isArray(faceDescriptors) || faceDescriptors.length === 0) {
      return res.status(400).json({ message: 'faceDescriptors array is required' });
    }

    if (faceDescriptors.some((descriptor) => !Array.isArray(descriptor) || descriptor.length !== 128)) {
      return res.status(400).json({ message: 'Each descriptor must contain 128 dimensions' });
    }

    const customers = await Customer.find();

    if (customers.length === 0) {
      return res.status(200).json({
        message: 'No customers enrolled yet',
        thresholdUsed: FACE_RECOGNITION_THRESHOLD,
        results: faceDescriptors.map((_, index) => ({
          index,
          matched: false,
        })),
      });
    }

    const results = faceDescriptors.map((descriptor, index) => {
      const match = getBestCustomerMatch(descriptor, customers);
      if (!match) {
        return {
          index,
          matched: false,
        };
      }

      return {
        index,
        matched: true,
        customer: {
          id: match.customer._id,
          name: match.customer.name,
        },
        matchConfidence: (1 - match.distance).toFixed(2),
        matchDistance: Number(match.distance.toFixed(4)),
      };
    });

    return res.status(200).json({
      message: 'Batch match complete',
      thresholdUsed: FACE_RECOGNITION_THRESHOLD,
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const recognizeCustomersBatch = async (req, res) => {
  try {
    const { faceDescriptors } = req.body;

    if (!Array.isArray(faceDescriptors) || faceDescriptors.length === 0) {
      return res.status(400).json({ message: 'faceDescriptors array is required' });
    }

    if (faceDescriptors.some((descriptor) => !Array.isArray(descriptor) || descriptor.length !== 128)) {
      return res.status(400).json({ message: 'Each descriptor must contain 128 dimensions' });
    }

    const customers = await Customer.find();
    if (customers.length === 0) {
      return res.status(404).json({ message: 'No customers enrolled yet' });
    }

    const recognizedByCustomer = new Map();
    const matchedDescriptorIndices = [];
    const unmatchedDescriptorIndices = [];

    for (let index = 0; index < faceDescriptors.length; index += 1) {
      const descriptor = faceDescriptors[index];
      const match = getBestCustomerMatch(descriptor, customers);
      if (!match) {
        unmatchedDescriptorIndices.push(index);
        continue;
      }

      matchedDescriptorIndices.push(index);

      const id = match.customer._id.toString();
      const existing = recognizedByCustomer.get(id);
      if (!existing || match.distance < existing.distance) {
        recognizedByCustomer.set(id, {
          ...match,
          descriptorIndex: index,
        });
      }
    }

    const recognizedEntries = Array.from(recognizedByCustomer.values());
    if (recognizedEntries.length === 0) {
      return res.status(200).json({
        message: 'No enrolled customers recognized',
        recognizedCount: 0,
        unrecognizedCount: unmatchedDescriptorIndices.length,
        matchedDescriptorIndices,
        unmatchedDescriptorIndices,
        thresholdUsed: FACE_RECOGNITION_THRESHOLD,
        results: [],
      });
    }

    const results = [];
    for (const entry of recognizedEntries) {
      const customer = entry.customer;
      const distance = entry.distance;

      customer.lastVisit = new Date();
      customer.visitCount += 1;
      await customer.save();

      const orders = await Order.find({ customer: customer._id })
        .populate('items.foodItem')
        .sort('-createdAt')
        .limit(10);

      results.push({
        customer: {
          id: customer._id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          preferences: customer.preferences,
          dietaryRestrictions: customer.dietaryRestrictions,
          visitCount: customer.visitCount,
          lastVisit: customer.lastVisit,
        },
        matchConfidence: (1 - distance).toFixed(2),
        matchDistance: Number(distance.toFixed(4)),
        matchedDescriptorIndex: entry.descriptorIndex,
        orderHistory: orders,
        isNewCustomer: false,
      });
    }

    return res.status(200).json({
      message: `Recognized ${results.length} customer(s)`,
      recognizedCount: results.length,
      unrecognizedCount: unmatchedDescriptorIndices.length,
      matchedDescriptorIndices,
      unmatchedDescriptorIndices,
      thresholdUsed: FACE_RECOGNITION_THRESHOLD,
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get personalized recommendations based on mood and order history
export const getRecommendations = async (req, res) => {
  try {
    const { customerId, mood } = req.body;

    if (!customerId || !mood) {
      return res.status(400).json({ message: 'Customer ID and mood are required' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer's order history
    const orders = await Order.find({ customer: customerId })
      .populate('items.foodItem')
      .sort('-createdAt')
      .limit(20);

    // Extract frequently ordered items
    const itemFrequency = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.foodItem) {
          const itemId = item.foodItem._id.toString();
          itemFrequency[itemId] = (itemFrequency[itemId] || 0) + item.quantity;
        }
      });
    });

    // Get all available food items
    let foodItems = await FoodItem.find({ isAvailable: true });

    // Filter based on dietary restrictions
    if (customer.dietaryRestrictions.length > 0) {
      foodItems = foodItems.filter(item => {
        if (customer.dietaryRestrictions.includes('vegetarian') && !item.isVegetarian) {
          return false;
        }
        if (customer.dietaryRestrictions.includes('vegan') && !item.isVegan) {
          return false;
        }
        if (customer.dietaryRestrictions.includes('gluten-free') && !item.isGlutenFree) {
          return false;
        }
        return true;
      });
    }

    // Score items based on mood, history, and preferences
    const scoredItems = foodItems.map(item => {
      let score = 0;

      // Mood matching (highest priority)
      if (item.moodTags.includes(mood.toLowerCase())) {
        score += 50;
      }

      // Order history
      const frequency = itemFrequency[item._id.toString()] || 0;
      score += frequency * 10;

      // Preferences
      if (customer.preferences.includes(item.category)) {
        score += 20;
      }

      return {
        ...item.toObject(),
        recommendationScore: score,
      };
    });

    // Sort by score and get top recommendations
    const recommendations = scoredItems
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 6);

    res.status(200).json({
      message: 'Recommendations generated',
      mood,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update customer information
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, preferences, dietaryRestrictions } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (email) customer.email = email;
    if (preferences) customer.preferences = preferences;
    if (dietaryRestrictions) customer.dietaryRestrictions = dietaryRestrictions;

    await customer.save();

    res.status(200).json({
      message: 'Customer updated successfully',
      customer,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate Euclidean distance
function euclideanDistance(descriptor1, descriptor2) {
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    sum += Math.pow(descriptor1[i] - descriptor2[i], 2);
  }
  return Math.sqrt(sum);
}
