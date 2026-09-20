-- Msosi ChapChap — Muundo wa Database (PostgreSQL)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80),
  emoji VARCHAR(10),
  rating NUMERIC(2,1) DEFAULT 5.0,
  prep_time VARCHAR(30),
  delivery_fee INTEGER NOT NULL DEFAULT 1500,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  price INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  rider_id INTEGER REFERENCES users(id),
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  commission INTEGER NOT NULL,
  total INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_restaurant',
  payment_method VARCHAR(30),
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  payment_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id),
  name VARCHAR(150) NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE payouts (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES users(id),
  order_id INTEGER REFERENCES orders(id),
  amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_menu_restaurant ON menu_items(restaurant_id);
