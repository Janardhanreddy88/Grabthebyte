
-- Update existing items with images
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop' WHERE id = '91885d9e-dc1b-4fb2-891b-d18a20357e43';
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop' WHERE id = '60877531-93cf-4927-8565-8ee7485f4f64';
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1633933358116-a27b902fad35?w=400&h=300&fit=crop' WHERE id = '57b7e5c8-8c19-4773-84ad-022ce9309fe9';
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop' WHERE id = '762b0321-71d6-4d04-8cf3-48a023d8fa0f';
UPDATE menu_items SET image_url = 'https://images.unsplash.com/photo-1632203171982-cc0df6e9ceb4?w=400&h=300&fit=crop' WHERE id = '999619f3-7fa4-4c59-8391-7fec9830da3b';

-- BREAKFAST items
INSERT INTO menu_items (campus_id, name, description, price, category, category_id, is_veg, is_available, is_popular, stock_quantity, image_url) VALUES
('86460363-0706-4602-a811-26d76a9c2515', 'Masala Dosa', 'Crispy dosa with spiced potato filling', 60, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', true, true, true, 50, 'https://images.unsplash.com/photo-1668236543090-82bbe8db4f66?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Poha', 'Flattened rice with peanuts and spices', 30, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', true, true, false, 40, 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Upma', 'Semolina cooked with vegetables', 35, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', true, true, false, 40, 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Medu Vada (2P)', 'Crispy lentil donuts with chutney', 40, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', true, true, true, 50, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Puri Bhaji', 'Deep fried bread with potato curry', 50, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', true, true, false, 30, 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Bread Omelette', 'Fluffy omelette with buttered toast', 45, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', false, true, false, 30, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Aloo Paratha', 'Stuffed potato flatbread with curd', 55, 'breakfast', 'f1b7b7e4-2fdc-42ab-91e8-4a12e949e459', true, true, true, 40, 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop');

-- LUNCH items
INSERT INTO menu_items (campus_id, name, description, price, category, category_id, is_veg, is_available, is_popular, stock_quantity, image_url) VALUES
('86460363-0706-4602-a811-26d76a9c2515', 'Veg Thali', 'Full meal with dal, sabzi, roti and rice', 80, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', true, true, true, 50, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Chicken Fried Rice', 'Indo-Chinese style fried rice', 90, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', false, true, true, 40, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Rajma Chawal', 'Kidney bean curry with steamed rice', 70, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', true, true, false, 35, 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Paneer Butter Masala', 'Rich creamy paneer curry with naan', 100, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', true, true, true, 30, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Egg Curry Rice', 'Spicy egg curry served with rice', 65, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', false, true, false, 40, 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Chole Bhature', 'Spiced chickpeas with fried bread', 75, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', true, true, false, 35, 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Mutton Biryani', 'Aromatic basmati rice with tender mutton', 150, 'lunch', '0006bce8-104c-438d-8bb7-ee1307717006', false, true, true, 20, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop');

-- SNACKS items
INSERT INTO menu_items (campus_id, name, description, price, category, category_id, is_veg, is_available, is_popular, stock_quantity, image_url) VALUES
('86460363-0706-4602-a811-26d76a9c2515', 'Samosa (2P)', 'Crispy pastry with spiced potato filling', 20, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', true, true, true, 60, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Veg Sandwich', 'Grilled sandwich with veggies and cheese', 40, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', true, true, false, 40, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Chicken Momos (6P)', 'Steamed dumplings with spicy chutney', 60, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', false, true, true, 40, 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'French Fries', 'Crispy golden fries with ketchup', 50, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', true, true, true, 50, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Vada Pav', 'Mumbai style potato fritter burger', 25, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', true, true, false, 50, 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Maggi Noodles', 'Classic 2-minute noodles with veggies', 30, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', true, true, false, 40, 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Spring Roll (4P)', 'Crispy rolls with veggie filling', 45, 'snaks', '93380680-a85b-496d-99bd-0faf07236140', true, true, false, 35, 'https://images.unsplash.com/photo-1548507346-b3e18c8fbc01?w=400&h=300&fit=crop');

-- ICE CREAMS items
INSERT INTO menu_items (campus_id, name, description, price, category, category_id, is_veg, is_available, is_popular, stock_quantity, image_url) VALUES
('86460363-0706-4602-a811-26d76a9c2515', 'Chocolate Sundae', 'Rich chocolate ice cream with fudge', 80, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, true, 30, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Vanilla Scoop', 'Classic vanilla bean ice cream', 40, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, false, 40, 'https://images.unsplash.com/photo-1570197571499-166b36435e9f?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Mango Kulfi', 'Traditional Indian mango ice cream', 50, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, true, 35, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Strawberry Cone', 'Fresh strawberry ice cream in cone', 45, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, false, 40, 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Oreo Shake', 'Creamy oreo milkshake with ice cream', 70, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, true, 30, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Pista Ice Cream', 'Premium pistachio flavored ice cream', 55, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, false, 35, 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop'),
('86460363-0706-4602-a811-26d76a9c2515', 'Choco Bar', 'Chocolate coated vanilla ice cream bar', 30, 'ice creams', '3447916e-0626-43c7-bab0-5c1c3b5d907b', true, true, false, 50, 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=300&fit=crop');
