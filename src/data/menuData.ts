import { MenuItem, Category } from '@/types/canteen';

export const categories: Category[] = [
  { id: 'all', name: 'All Items', icon: '🍽️' },
  { id: 'breakfast', name: 'Breakfast', icon: '🍳' },
  { id: 'lunch', name: 'Lunch', icon: '🍱' },
  { id: 'snacks', name: 'Snacks', icon: '🍪' },
  { id: 'colddrinks', name: 'Cold Drinks', icon: '🥤' },
  { id: 'icecream', name: 'Ice Cream', icon: '🍦' },
];

export const menuItems: MenuItem[] = [
  // ========== BREAKFAST ==========
  { id: 'b1', name: 'Masala Dosa', description: 'Crispy rice crepe with spiced potato filling, served with chutney & sambar', price: 50, image: 'https://images.unsplash.com/photo-1668236543090-82eb5eaf701b?w=400', category: 'breakfast', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'b2', name: 'Idli (3 pcs)', description: 'Steamed rice cakes served with coconut chutney and sambar', price: 25, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400', category: 'breakfast', isVeg: true, isAvailable: true },
  { id: 'b3', name: 'Poha', description: 'Flattened rice tempered with mustard seeds, peanuts & curry leaves', price: 30, image: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400', category: 'breakfast', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'b4', name: 'Upma', description: 'Semolina porridge with vegetables, mustard & cashews', price: 25, image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=400', category: 'breakfast', isVeg: true, isAvailable: true },
  { id: 'b5', name: 'Puri Bhaji', description: 'Deep-fried puffed bread with spiced potato curry', price: 40, image: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400', category: 'breakfast', isVeg: true, isAvailable: true },
  { id: 'b6', name: 'Vada (2 pcs)', description: 'Crispy lentil fritters served with chutney and sambar', price: 20, image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400', category: 'breakfast', isVeg: true, isAvailable: true },
  { id: 'b7', name: 'Masala Chai', description: 'Hot spiced Indian tea with milk and cardamom', price: 15, image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400', category: 'breakfast', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'b8', name: 'Bread Omelette', description: 'Fluffy egg omelette with onions, tomatoes & green chillies, served with toast', price: 35, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400', category: 'breakfast', isVeg: false, isAvailable: true },

  // ========== LUNCH ==========
  { id: 'l1', name: 'Chicken Biryani', description: 'Aromatic basmati rice with tender chicken and whole spices', price: 120, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', category: 'lunch', isVeg: false, isPopular: true, isAvailable: true },
  { id: 'l2', name: 'Veg Biryani', description: 'Fragrant rice with mixed vegetables, herbs & saffron', price: 90, image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400', category: 'lunch', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'l3', name: 'South Indian Thali', description: 'Rice, sambar, rasam, curd, vegetable curry & papad', price: 80, image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400', category: 'lunch', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'l4', name: 'Parota with Curry', description: 'Soft layered flatbread served with spicy egg or veg curry', price: 45, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', category: 'lunch', isVeg: true, isAvailable: true },
  { id: 'l5', name: 'Chicken Fried Rice', description: 'Wok-tossed rice with chicken, egg & mixed vegetables', price: 100, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400', category: 'lunch', isVeg: false, isAvailable: true },
  { id: 'l6', name: 'Curd Rice', description: 'Cooling yogurt rice tempered with mustard seeds & curry leaves', price: 40, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', category: 'lunch', isVeg: true, isAvailable: true },
  { id: 'l7', name: 'Chapati with Dal', description: 'Whole wheat flatbread with slow-cooked yellow lentil dal', price: 50, image: 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=400', category: 'lunch', isVeg: true, isAvailable: true },
  { id: 'l8', name: 'Sweet Lassi', description: 'Refreshing yogurt drink with a hint of cardamom', price: 30, image: 'https://images.unsplash.com/photo-1626201850386-e77fbdb68a59?w=400', category: 'lunch', isVeg: true, isAvailable: true },

  // ========== SNACKS ==========
  { id: 's1', name: 'Samosa (2 pcs)', description: 'Crispy fried pastry with spiced potato filling', price: 20, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400', category: 'snacks', isVeg: true, isPopular: true, isAvailable: true },
  { id: 's2', name: 'Veg Puff', description: 'Flaky golden pastry with spiced vegetable filling', price: 15, image: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400', category: 'snacks', isVeg: true, isAvailable: true },
  { id: 's3', name: 'Cold Coffee', description: 'Chilled coffee blended with cream and ice', price: 40, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', category: 'snacks', isVeg: true, isPopular: true, isAvailable: true },
  { id: 's4', name: 'Maggi Noodles', description: 'Instant noodles tossed with vegetables and Indian spices', price: 30, image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400', category: 'snacks', isVeg: true, isPopular: true, isAvailable: true },
  { id: 's5', name: 'Veg Sandwich', description: 'Grilled sandwich with cucumber, tomato, cheese & chutney', price: 35, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400', category: 'snacks', isVeg: true, isAvailable: true },
  { id: 's6', name: 'Mirchi Bajji (4 pcs)', description: 'Batter-fried green chillies stuffed with spiced potato', price: 25, image: 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=400', category: 'snacks', isVeg: true, isAvailable: true },
  { id: 's7', name: 'Spring Roll (3 pcs)', description: 'Crispy rolls stuffed with mixed vegetables', price: 35, image: 'https://images.unsplash.com/photo-1548507200-b4d2e6b15890?w=400', category: 'snacks', isVeg: true, isAvailable: true },
  { id: 's8', name: 'Masala Chai', description: 'Hot spiced tea — the perfect evening pick-me-up', price: 15, image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400', category: 'snacks', isVeg: true, isAvailable: true },

  // ========== COLD DRINKS ==========
  { id: 'cd1', name: 'Cold Coffee', description: 'Chilled coffee blended with cream, milk and ice', price: 40, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', category: 'colddrinks', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'cd2', name: 'Sweet Lassi', description: 'Refreshing yogurt drink with a hint of cardamom', price: 30, image: 'https://images.unsplash.com/photo-1626201850386-e77fbdb68a59?w=400', category: 'colddrinks', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'cd3', name: 'Mango Lassi', description: 'Thick creamy mango yogurt smoothie', price: 35, image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400', category: 'colddrinks', isVeg: true, isAvailable: true },
  { id: 'cd4', name: 'Buttermilk', description: 'Spiced chaas with cumin, mint & a squeeze of lemon', price: 15, image: 'https://images.unsplash.com/photo-1604882355474-b5e38854cda4?w=400', category: 'colddrinks', isVeg: true, isAvailable: true },
  { id: 'cd5', name: 'Lemon Soda', description: 'Fizzy fresh lemon soda — sweet, salty or mixed', price: 20, image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400', category: 'colddrinks', isVeg: true, isAvailable: true },
  { id: 'cd6', name: 'Thumbs Up', description: 'Chilled 300ml bottle of classic Indian cola', price: 20, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400', category: 'colddrinks', isVeg: true, isAvailable: true },
  { id: 'cd7', name: 'Fresh Juice', description: 'Seasonal fresh fruit juice — watermelon, orange or mosambi', price: 35, image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400', category: 'colddrinks', isVeg: true, isAvailable: true },
  { id: 'cd8', name: 'Chocolate Milkshake', description: 'Thick creamy chocolate shake topped with whipped cream', price: 50, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400', category: 'colddrinks', isVeg: true, isPopular: true, isAvailable: true },

  // ========== ICE CREAM ==========
  { id: 'ic1', name: 'Vanilla Cup', description: 'Classic creamy vanilla ice cream in a cup', price: 30, image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400', category: 'icecream', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'ic2', name: 'Chocolate Cone', description: 'Rich chocolate ice cream served in a crispy wafer cone', price: 35, image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400', category: 'icecream', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'ic3', name: 'Mango Dolly', description: 'Refreshing mango-flavored ice cream bar', price: 20, image: 'https://images.unsplash.com/photo-1629385701021-fcd568a743e8?w=400', category: 'icecream', isVeg: true, isAvailable: true },
  { id: 'ic4', name: 'Butterscotch Sundae', description: 'Butterscotch ice cream topped with caramel sauce & crunchy nuts', price: 50, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400', category: 'icecream', isVeg: true, isPopular: true, isAvailable: true },
  { id: 'ic5', name: 'Strawberry Cup', description: 'Sweet strawberry ice cream with real fruit bits', price: 35, image: 'https://images.unsplash.com/photo-1633933358116-a27b902fad35?w=400', category: 'icecream', isVeg: true, isAvailable: true },
  { id: 'ic6', name: 'Kulfi Stick', description: 'Traditional Indian frozen dessert with pistachios & cardamom', price: 25, image: 'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=400', category: 'icecream', isVeg: true, isAvailable: true },
];

export function getPopularItemsNow(): MenuItem[] {
  return menuItems.filter(item => item.isPopular);
}
