export interface PlaceCategoryIcon {
  name: string;
  label: string;
  category: string;
}

export const PLACE_ICON_CATEGORIES = [
  'All',
  'Living',
  'Work',
  'Health',
  'Dining',
  'Travel',
  'Shopping',
  'Outdoors',
  'Leisure',
] as const;

export type PlaceCategory = typeof PLACE_ICON_CATEGORIES[number];

/**
 * 60+ Curated Ionicons for the Safe Places Icon Hub.
 * Covers all frequent personal, professional, recreational, and transit locations.
 */
export const PLACE_ICONS: PlaceCategoryIcon[] = [
  // Living & Personal
  { name: 'home', label: 'Home', category: 'Living' },
  { name: 'business', label: 'Condo / Apt', category: 'Living' },
  { name: 'bed', label: 'Bedroom / Dorm', category: 'Living' },
  { name: 'key', label: 'Private Room', category: 'Living' },
  { name: 'shield', label: 'Safe Zone', category: 'Living' },
  { name: 'bonfire', label: 'Cabin / Retreat', category: 'Living' },
  { name: 'water', label: 'Lakeside / Pool', category: 'Living' },

  // Work & Career
  { name: 'briefcase', label: 'Office / HQ', category: 'Work' },
  { name: 'laptop', label: 'Co-working', category: 'Work' },
  { name: 'desktop', label: 'Studio / Lab', category: 'Work' },
  { name: 'construct', label: 'Workshop', category: 'Work' },
  { name: 'hammer', label: 'Job Site', category: 'Work' },
  { name: 'build', label: 'Operations', category: 'Work' },
  { name: 'easel', label: 'Art Studio', category: 'Work' },
  { name: 'pencil', label: 'Design Office', category: 'Work' },
  { name: 'school', label: 'School / Univ', category: 'Work' },
  { name: 'book', label: 'Study Center', category: 'Work' },
  { name: 'library', label: 'Library', category: 'Work' },

  // Health, Fitness & Sports
  { name: 'fitness', label: 'Fitness Center', category: 'Health' },
  { name: 'barbell', label: 'Weight Gym', category: 'Health' },
  { name: 'heart', label: 'Wellness Clinic', category: 'Health' },
  { name: 'medkit', label: 'Hospital', category: 'Health' },
  { name: 'pulse', label: 'Pharmacy', category: 'Health' },
  { name: 'bicycle', label: 'Bike Path', category: 'Health' },
  { name: 'walk', label: 'Walking Trail', category: 'Health' },
  { name: 'football', label: 'Football Field', category: 'Health' },
  { name: 'basketball', label: 'Basketball Court', category: 'Health' },
  { name: 'tennisball', label: 'Tennis Court', category: 'Health' },

  // Dining & Food
  { name: 'restaurant', label: 'Restaurant', category: 'Dining' },
  { name: 'cafe', label: 'Cafe / Coffee', category: 'Dining' },
  { name: 'fast-food', label: 'Fast Food', category: 'Dining' },
  { name: 'pizza', label: 'Pizzeria', category: 'Dining' },
  { name: 'beer', label: 'Pub / Bar', category: 'Dining' },
  { name: 'wine', label: 'Wine Lounge', category: 'Dining' },
  { name: 'ice-cream', label: 'Dessert Spot', category: 'Dining' },
  { name: 'nutrition', label: 'Bakery / Deli', category: 'Dining' },

  // Travel & Transit
  { name: 'car', label: 'Parking Garage', category: 'Travel' },
  { name: 'bus', label: 'Bus Station', category: 'Travel' },
  { name: 'train', label: 'Train Station', category: 'Travel' },
  { name: 'subway', label: 'Metro / Subway', category: 'Travel' },
  { name: 'airplane', label: 'Airport', category: 'Travel' },
  { name: 'boat', label: 'Ferry / Pier', category: 'Travel' },
  { name: 'trail-sign', label: 'Trailhead', category: 'Travel' },
  { name: 'navigate', label: 'Waypoint', category: 'Travel' },
  { name: 'compass', label: 'Meeting Spot', category: 'Travel' },

  // Shopping & Services
  { name: 'cart', label: 'Supermarket', category: 'Shopping' },
  { name: 'bag-handle', label: 'Shopping Mall', category: 'Shopping' },
  { name: 'pricetag', label: 'Local Market', category: 'Shopping' },
  { name: 'storefront', label: 'Corner Store', category: 'Shopping' },
  { name: 'card', label: 'Bank / ATM', category: 'Shopping' },
  { name: 'basket', label: 'Grocery Store', category: 'Shopping' },
  { name: 'gift', label: 'Gift Shop', category: 'Shopping' },

  // Outdoors & Nature
  { name: 'leaf', label: 'Park', category: 'Outdoors' },
  { name: 'flower', label: 'Garden', category: 'Outdoors' },
  { name: 'sunny', label: 'Beach / Plaza', category: 'Outdoors' },
  { name: 'planet', label: 'Open Space', category: 'Outdoors' },

  // Leisure & Entertainment
  { name: 'film', label: 'Cinema', category: 'Leisure' },
  { name: 'game-controller', label: 'Gaming Arcade', category: 'Leisure' },
  { name: 'musical-notes', label: 'Music Hall', category: 'Leisure' },
  { name: 'camera', label: 'Scenic View', category: 'Leisure' },
  { name: 'sparkles', label: 'Favorite Spot', category: 'Leisure' },
  { name: 'star', label: 'Special Place', category: 'Leisure' },
  { name: 'happy', label: 'Hangout', category: 'Leisure' },
  { name: 'location', label: 'General Pin', category: 'Leisure' },
];
