import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FoodItem from './models/FoodItem.js';

dotenv.config();

const sampleFoodItems = [
  { name: 'Smoky Paneer Tikka', category: 'appetizer', description: 'Char-grilled paneer with bell peppers', price: 8.5, isVegetarian: true, spicyLevel: 2, moodTags: ['happy', 'energetic'] },
  { name: 'Crispy Corn Pepper', category: 'appetizer', description: 'Golden sweet corn tossed in cracked pepper', price: 7.25, isVegetarian: true, isVegan: true, spicyLevel: 1, moodTags: ['neutral', 'relaxing'] },
  { name: 'Garlic Herb Mushrooms', category: 'appetizer', description: 'Sauteed mushrooms in garlic butter herbs', price: 7.95, isVegetarian: true, spicyLevel: 0, moodTags: ['comfort', 'relaxing'] },
  { name: 'Peri Peri Chicken Bites', category: 'appetizer', description: 'Juicy chicken bites with peri peri glaze', price: 9.75, spicyLevel: 3, moodTags: ['energetic', 'angry'] },
  { name: 'Classic Bruschetta', category: 'appetizer', description: 'Toasted bread with tomato basil topping', price: 6.9, isVegetarian: true, moodTags: ['happy', 'neutral'] },
  { name: 'Nacho Fiesta Bowl', category: 'appetizer', description: 'Crunchy nachos with salsa and melted cheese', price: 8.2, isVegetarian: true, spicyLevel: 1, moodTags: ['happy', 'comfort'] },
  { name: 'Spicy Buffalo Wings', category: 'appetizer', description: 'Crispy wings in bold buffalo sauce', price: 10.25, spicyLevel: 5, moodTags: ['angry', 'energetic'] },
  { name: 'Avocado Hummus Platter', category: 'appetizer', description: 'Smooth hummus with pita and veggie sticks', price: 8.15, isVegetarian: true, isVegan: true, moodTags: ['relaxing', 'neutral'] },

  { name: 'Butter Chicken Rice Bowl', category: 'main', description: 'Creamy butter chicken with fragrant rice', price: 13.5, spicyLevel: 2, moodTags: ['comfort', 'happy'] },
  { name: 'Veggie Lasagna Slice', category: 'main', description: 'Layered lasagna with roasted vegetables', price: 12.4, isVegetarian: true, moodTags: ['comfort', 'neutral'] },
  { name: 'Thai Green Curry Noodles', category: 'main', description: 'Thai curry tossed with noodles and veggies', price: 12.95, isVegetarian: true, spicyLevel: 3, moodTags: ['energetic', 'happy'] },
  { name: 'Mushroom Truffle Pasta', category: 'main', description: 'Creamy truffle pasta with sauteed mushrooms', price: 14.25, isVegetarian: true, moodTags: ['relaxing', 'comfort'] },
  { name: 'Grilled Herb Fish Fillet', category: 'main', description: 'Fresh fish fillet with lemon herb seasoning', price: 15.75, isGlutenFree: true, moodTags: ['neutral', 'relaxing'] },
  { name: 'Paneer Butter Masala', category: 'main', description: 'Rich and velvety paneer curry', price: 12.7, isVegetarian: true, spicyLevel: 1, moodTags: ['comfort', 'sad'] },
  { name: 'Chicken Shawarma Plate', category: 'main', description: 'Middle eastern spiced chicken with pita', price: 13.2, spicyLevel: 2, moodTags: ['energetic', 'happy'] },
  { name: 'Mexican Burrito Supreme', category: 'main', description: 'Loaded burrito with beans, rice, and salsa', price: 11.95, spicyLevel: 2, moodTags: ['happy', 'energetic'] },
  { name: 'Teriyaki Tofu Stir Fry', category: 'main', description: 'Tofu stir fry with teriyaki glaze', price: 11.6, isVegetarian: true, isVegan: true, moodTags: ['neutral', 'relaxing'] },
  { name: 'Classic Margherita Pizza', category: 'main', description: 'Stone baked pizza with mozzarella and basil', price: 12.8, isVegetarian: true, moodTags: ['happy', 'comfort'] },
  { name: 'Spicy Chicken Pizza', category: 'main', description: 'Pizza topped with spicy chicken and onions', price: 13.9, spicyLevel: 4, moodTags: ['energetic', 'angry'] },
  { name: 'Quinoa Power Bowl', category: 'main', description: 'Protein rich quinoa bowl with roasted veggies', price: 11.25, isVegetarian: true, isVegan: true, isGlutenFree: true, moodTags: ['neutral', 'energetic'] },
  { name: 'Classic Tiramisu Cup', category: 'dessert', description: 'Coffee layered Italian dessert cup', price: 6.75, isVegetarian: true, moodTags: ['happy', 'neutral'] },
  { name: 'Double Chocolate Brownie', category: 'dessert', description: 'Dense brownie served warm', price: 5.95, isVegetarian: true, moodTags: ['comfort', 'sad'] },
  { name: 'Blueberry Cheesecake', category: 'dessert', description: 'Creamy cheesecake with blueberry compote', price: 7.1, isVegetarian: true, moodTags: ['happy', 'surprised'] },
  { name: 'Mango Sticky Rice', category: 'dessert', description: 'Sweet coconut rice with ripe mango', price: 6.4, isVegetarian: true, isVegan: true, moodTags: ['relaxing', 'happy'] },
  { name: 'Vanilla Bean Panna Cotta', category: 'dessert', description: 'Silky panna cotta with berry sauce', price: 6.8, isVegetarian: true, moodTags: ['neutral', 'relaxing'] },
  { name: 'Choco Hazelnut Sundae', category: 'dessert', description: 'Ice cream sundae with hazelnut crunch', price: 6.2, isVegetarian: true, moodTags: ['happy', 'comfort'] },
  { name: 'Caramel Apple Pie', category: 'dessert', description: 'Warm apple pie with caramel drizzle', price: 6.5, isVegetarian: true, moodTags: ['comfort', 'sad'] },
  { name: 'Pistachio Kulfi Stick', category: 'dessert', description: 'Traditional pistachio milk kulfi', price: 4.9, isVegetarian: true, moodTags: ['neutral', 'happy'] },

  { name: 'Iced Americano', category: 'beverage', description: 'Cold brew style black coffee', price: 3.25, isVegan: true, moodTags: ['energetic', 'neutral'] },
  { name: 'Mocha Frappuccino', category: 'beverage', description: 'Blended mocha coffee with cream', price: 4.95, isVegetarian: true, moodTags: ['happy', 'energetic'] },
  { name: 'Classic Masala Chai', category: 'beverage', description: 'Spiced Indian tea brewed fresh', price: 2.85, isVegetarian: true, moodTags: ['comfort', 'relaxing'] },
  { name: 'Fresh Mint Lemon Cooler', category: 'beverage', description: 'Citrus drink with mint leaves', price: 3.6, isVegan: true, moodTags: ['happy', 'energetic'] },
  { name: 'Berry Kombucha Sparkle', category: 'beverage', description: 'Lightly fermented sparkling berry drink', price: 4.4, isVegan: true, moodTags: ['surprised', 'energetic'] },
  { name: 'Salted Caramel Milkshake', category: 'beverage', description: 'Thick milkshake with caramel notes', price: 5.5, isVegetarian: true, moodTags: ['comfort', 'happy'] },
  { name: 'Tropical Coconut Water', category: 'beverage', description: 'Chilled natural coconut water', price: 3.1, isVegan: true, isGlutenFree: true, moodTags: ['relaxing', 'neutral'] },
  { name: 'Spiced Tomato Soup Shot', category: 'beverage', description: 'Warm tomato soup served as a sip cup', price: 3.9, isVegetarian: true, spicyLevel: 1, moodTags: ['comfort', 'sad'] },

  { name: 'Herb Garlic Bread', category: 'side', description: 'Toasted bread with garlic herb butter', price: 3.95, isVegetarian: true, moodTags: ['comfort', 'neutral'] },
  { name: 'Crispy Waffle Fries', category: 'side', description: 'Seasoned waffle fries', price: 4.6, isVegetarian: true, moodTags: ['happy', 'comfort'] },
  { name: 'Sauteed Butter Veggies', category: 'side', description: 'Seasonal vegetables in herb butter', price: 4.2, isVegetarian: true, moodTags: ['neutral', 'relaxing'] },
  { name: 'Steamed Jasmine Rice', category: 'side', description: 'Soft fragrant jasmine rice', price: 2.9, isVegetarian: true, isVegan: true, isGlutenFree: true, moodTags: ['neutral', 'relaxing'] },
  { name: 'Tangy Coleslaw Cup', category: 'side', description: 'Crunchy cabbage slaw with tangy dressing', price: 3.3, isVegetarian: true, moodTags: ['happy', 'neutral'] },
  { name: 'Roasted Baby Potatoes', category: 'side', description: 'Oven roasted potatoes with rosemary', price: 4.35, isVegetarian: true, isVegan: true, moodTags: ['comfort', 'relaxing'] },
  { name: 'Classic Caesar Side Salad', category: 'side', description: 'Crisp romaine with creamy dressing', price: 4.75, moodTags: ['neutral', 'relaxing'] },
  { name: 'Spicy Kimchi Slaw', category: 'side', description: 'Fermented cabbage slaw with chili', price: 4.55, isVegan: true, spicyLevel: 3, moodTags: ['energetic', 'angry'] },

  { name: 'Chef Special Platter One', category: 'special', description: 'Curated tasting platter from the chef', price: 18.5, moodTags: ['surprised', 'happy'] },
  { name: 'Chef Special Platter Two', category: 'special', description: 'Premium mixed grill and sides', price: 20.95, spicyLevel: 2, moodTags: ['surprised', 'energetic'] },
  { name: 'Weekend Brunch Signature', category: 'special', description: 'Limited brunch combo with beverage', price: 16.75, moodTags: ['happy', 'relaxing'] },
  { name: 'Festival Sweet Sampler', category: 'special', description: 'Assorted mini desserts and sweets', price: 14.8, isVegetarian: true, moodTags: ['happy', 'comfort'] },
  { name: 'Midnight Craving Combo', category: 'special', description: 'Late night combo with snack and drink', price: 13.65, moodTags: ['comfort', 'energetic'] },
  { name: 'Detox Wellness Plate', category: 'special', description: 'Lean protein, greens and herbal drink', price: 15.4, isGlutenFree: true, moodTags: ['neutral', 'relaxing'] },
];

const seedFoodItems = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing food items
    await FoodItem.deleteMany({});
    console.log('Cleared existing food items');

    // Insert sample data
    await FoodItem.insertMany(sampleFoodItems);
    console.log(`✅ Successfully seeded ${sampleFoodItems.length} food items`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding food items:', error.message);
    process.exit(1);
  }
};

seedFoodItems();
