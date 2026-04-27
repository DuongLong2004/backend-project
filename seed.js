



require("dotenv").config();
const { sequelize, Product } = require("./src/models/index");

// ✅ Price dạng số (DECIMAL) thay vì string "33.990.000₫"
const products = [
  // ==================== PHONES ====================
  {
    brand: "Apple", title: "iPhone 16 Pro Max",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-16-pro-max_1.png",
    discount: 5, price: 33990000, oldPrice: 35990000,
    category: "phone", nation: "Mỹ", display: "6.9 inches",
    screenTech: "Super Retina XDR", ram: "8 GB", rom: "256 GB",
    chip: "A18 Pro", camera: "48MP + 12MP", battery: "4670mAh", charging: "Sạc nhanh 30W",
    description: "iPhone 16 Pro Max dùng chip A18 Pro, camera 48MP, màn hình 6.9 inch và pin 4670mAh.",
    stock: 50,
  },
  {
    brand: "Apple", title: "iPhone 16",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-16-1.png",
    discount: 4, price: 21990000, oldPrice: 23990000,
    category: "phone", nation: "Mỹ", display: "6.1 inches",
    screenTech: "Super Retina XDR", ram: "6 GB", rom: "128 GB",
    chip: "A18", camera: "48MP", battery: "3400mAh", charging: "Sạc nhanh 25W",
    description: "iPhone 16 trang bị chip A18, camera 48MP và màn hình Super Retina 6.1 inch.",
    stock: 50,
  },
  {
    brand: "Apple", title: "iPhone 15 Pro Max",
    img: "https://cdn.hoanghamobile.vn/Uploads/2025/01/23/15-pro-max-512-thumb.png",
    discount: 3, price: 28990000, oldPrice: 32990000,
    category: "phone", nation: "Mỹ", display: "6.7 inches",
    screenTech: "Super Retina XDR", ram: "8 GB", rom: "256 GB",
    chip: "A17 Pro", camera: "48MP + Tele 5X", battery: "4422mAh", charging: "Sạc nhanh 27W",
    description: "iPhone 15 Pro Max trang bị chip A17 Pro, camera Tele 5X và khung Titan.",
    stock: 50,
  },
  {
    brand: "Samsung", title: "Samsung Galaxy S25 Ultra",
    img: "https://cdn2.cellphones.com.vn/x/media/catalog/product/d/i/dien-thoai-samsung-galaxy-s25-ultra_1__1.png",
    discount: 8, price: 25490000, oldPrice: 27690000,
    category: "phone", nation: "Hàn Quốc", display: "6.8 inches",
    screenTech: "Dynamic AMOLED 2X", ram: "12 GB", rom: "256 GB",
    chip: "Exynos 9900", camera: "200MP + 50MP", battery: "5000mAh", charging: "Sạc nhanh 45W",
    description: "Samsung S25 Ultra có camera 200MP, chip Exynos 9900 và màn hình Dynamic AMOLED 2X.",
    stock: 50,
  },
  {
    brand: "Samsung", title: "Samsung Galaxy S24 Ultra",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/s/ss-s24-ultra-xam-222.png",
    discount: 6, price: 20990000, oldPrice: 26990000,
    category: "phone", nation: "Hàn Quốc", display: "6.8 inches",
    screenTech: "Dynamic AMOLED 2X", ram: "12 GB", rom: "256 GB",
    chip: "Snapdragon 8 Gen 3", camera: "200MP", battery: "5000mAh", charging: "Sạc nhanh 45W",
    description: "Galaxy S24 Ultra sử dụng Snapdragon 8 Gen 3 và hệ thống AI mạnh mẽ.",
    stock: 50,
  },
  {
    brand: "Samsung", title: "Samsung Galaxy A55",
    img: "https://cdn2.cellphones.com.vn/x/media/catalog/product/s/a/samsung-galaxy-a55.png",
    discount: 7, price: 8490000, oldPrice: 9490000,
    category: "phone", nation: "Hàn Quốc", display: "6.6 inches",
    screenTech: "Super AMOLED 120Hz", ram: "8 GB", rom: "128 GB",
    chip: "Exynos 1480", camera: "50MP", battery: "5000mAh", charging: "Sạc nhanh 25W",
    description: "Samsung A55 với màn hình AMOLED 120Hz và camera 50MP.",
    stock: 50,
  },
  {
    brand: "Xiaomi", title: "Xiaomi 14 Ultra",
    img: "https://cdn.hoanghamobile.vn/Uploads/2024/03/10/xiaomi-14-ultra.png",
    discount: 10, price: 22490000, oldPrice: 24990000,
    category: "phone", nation: "Trung Quốc", display: "6.73 inches",
    screenTech: "LTPO AMOLED", ram: "16 GB", rom: "512 GB",
    chip: "Snapdragon 8 Gen 3", camera: "50MP Leica", battery: "5000mAh", charging: "Sạc nhanh 90W",
    description: "Xiaomi 14 Ultra với camera Leica, hiệu năng mạnh, sạc nhanh 90W.",
    stock: 50,
  },
  {
    brand: "Xiaomi", title: "Xiaomi 13T Pro",
    img: "https://cdn.hoanghamobile.vn/Uploads/2023/09/20/13t-pro.png",
    discount: 12, price: 12490000, oldPrice: 15990000,
    category: "phone", nation: "Trung Quốc", display: "6.67 inches",
    screenTech: "AMOLED 144Hz", ram: "12 GB", rom: "256 GB",
    chip: "Dimensity 9200+", camera: "50MP Leica", battery: "5000mAh", charging: "Sạc nhanh 120W",
    description: "Xiaomi 13T Pro có camera Leica và sạc nhanh 120W.",
    stock: 50,
  },
  {
    brand: "OPPO", title: "OPPO Find X7 Ultra",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/e/d/eda006276802c_1_1.jpg",
    discount: 7, price: 21990000, oldPrice: 23990000,
    category: "phone", nation: "Trung Quốc", display: "6.82 inches",
    screenTech: "AMOLED ProXDR", ram: "12 GB", rom: "256 GB",
    chip: "Snapdragon 8 Gen 3", camera: "50MP", battery: "5000mAh", charging: "Sạc nhanh 100W",
    description: "OPPO Find X7 Ultra với màn ProXDR và sạc nhanh 100W.",
    stock: 50,
  },
  {
    brand: "OPPO", title: "OPPO Reno 11",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/d/i/dien-thoai-oppo-reno12-5g_10__1.png",
    discount: 9, price: 8990000, oldPrice: 9990000,
    category: "phone", nation: "Trung Quốc", display: "6.7 inches",
    screenTech: "AMOLED 120Hz", ram: "8 GB", rom: "256 GB",
    chip: "Dimensity 7050", camera: "50MP", battery: "5000mAh", charging: "67W",
    description: "OPPO Reno 11 thiết kế mỏng đẹp, camera 50MP.",
    stock: 50,
  },
  {
    brand: "Vivo", title: "Vivo X100 Pro",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/d/i/dien-thoai-vivo-x100-pro_1_.png",
    discount: 6, price: 19990000, oldPrice: 21990000,
    category: "phone", nation: "Trung Quốc", display: "6.78 inches",
    screenTech: "AMOLED 120Hz", ram: "12 GB", rom: "256 GB",
    chip: "Dimensity 9300", camera: "50MP ZEISS", battery: "5400mAh", charging: "Sạc nhanh 120W",
    description: "Vivo X100 Pro dùng camera ZEISS và chip Dimensity 9300.",
    stock: 50,
  },
  {
    brand: "Vivo", title: "Vivo V30",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/d/i/dien-thoai-vivo-v30-pro_1_.png",
    discount: 8, price: 7990000, oldPrice: 8990000,
    category: "phone", nation: "Trung Quốc", display: "6.78 inches",
    screenTech: "AMOLED 120Hz", ram: "8 GB", rom: "128 GB",
    chip: "Snapdragon 7 Gen 3", camera: "50MP", battery: "5000mAh", charging: "Sạc nhanh 80W",
    description: "Vivo V30 có camera 50MP và thiết kế siêu mỏng.",
    stock: 50,
  },

  // ==================== LAPTOPS ====================
  {
    brand: "Apple", title: "MacBook Air M3 13 inch 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/m/a/macbook_2__5.png",
    discount: 3, price: 27490000, oldPrice: 28490000,
    category: "laptop", nation: "Mỹ", display: "13.6 inches",
    screenTech: "Liquid Retina", ram: "8 GB", rom: "256 GB SSD",
    chip: "Apple M3", camera: "FaceTime HD", battery: "Khoảng 15 giờ", charging: "USB-C 30W",
    description: "MacBook Air M3 13 2024 hiệu năng cao, thiết kế mỏng nhẹ, pin 15 giờ.",
    stock: 30,
  },
  {
    brand: "Apple", title: "MacBook Pro 14 inch M3 Pro 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/g/r/group_560_3_.png",
    discount: 5, price: 45990000, oldPrice: 48990000,
    category: "laptop", nation: "Mỹ", display: "14.2 inches",
    screenTech: "Liquid Retina XDR 120Hz", ram: "16 GB", rom: "512 GB SSD",
    chip: "Apple M3 Pro", camera: "FaceTime HD", battery: "18 giờ", charging: "MagSafe 70W",
    description: "MacBook Pro M3 Pro với màn hình XDR 120Hz, hiệu năng cực mạnh.",
    stock: 20,
  },
  {
    brand: "Apple", title: "MacBook Air M2 15 inch",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/m/a/macbook_16__1.png",
    discount: 7, price: 30990000, oldPrice: 33990000,
    category: "laptop", nation: "Mỹ", display: "15.3 inches",
    screenTech: "Liquid Retina", ram: "8 GB", rom: "256 GB SSD",
    chip: "Apple M2", camera: "FaceTime HD", battery: "15 giờ", charging: "USB-C 35W",
    description: "MacBook Air 15 M2 có màn lớn, pin trâu, phù hợp học sinh - sinh viên.",
    stock: 30,
  },
  {
    brand: "ASUS", title: "ASUS ROG Strix G16 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/g/r/group_874_3.png",
    discount: 8, price: 42490000, oldPrice: 45990000,
    category: "laptop", nation: "Đài Loan", display: "16 inches",
    screenTech: "ROG Nebula Display 165Hz", ram: "16 GB", rom: "1 TB SSD",
    chip: "Intel Core i9-14900HX", camera: "FHD", battery: "90Wh", charging: "330W",
    description: "ROG Strix G16 2024 chiến mọi game AAA, màn Nebula 165Hz, RTX 4070.",
    stock: 20,
  },
  {
    brand: "ASUS", title: "ASUS TUF Gaming F15 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/e/text_d_i_7_36.png",
    discount: 10, price: 23990000, oldPrice: 26990000,
    category: "laptop", nation: "Đài Loan", display: "15.6 inches",
    screenTech: "IPS 144Hz", ram: "16 GB", rom: "512 GB SSD",
    chip: "Intel Core i7-13650HX", camera: "HD", battery: "90Wh", charging: "200W",
    description: "ASUS TUF F15 cấu hình mạnh, tản nhiệt tốt, gaming tầm trung.",
    stock: 30,
  },
  {
    brand: "Dell", title: "Dell XPS 13 Plus 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/l/a/laptop-dell-inspiron-15-3530-p112f010_6_.png",
    discount: 4, price: 34490000, oldPrice: 36990000,
    category: "laptop", nation: "Mỹ", display: "13.4 inches",
    screenTech: "OLED 3.5K", ram: "16 GB", rom: "512 GB SSD",
    chip: "Intel Core Ultra 7", camera: "FHD", battery: "55Wh", charging: "60W USB-C",
    description: "Dell XPS 13 Plus cực mỏng nhẹ, màn OLED đẹp, phù hợp doanh nhân.",
    stock: 20,
  },
  {
    brand: "Dell", title: "Dell Inspiron 15 3530",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/g/r/group_843_1.png",
    discount: 11, price: 12490000, oldPrice: 13990000,
    category: "laptop", nation: "Mỹ", display: "15.6 inches",
    screenTech: "IPS Full HD", ram: "8 GB", rom: "512 GB SSD",
    chip: "Intel Core i5-1335U", camera: "HD", battery: "54Wh", charging: "65W",
    description: "Dell Inspiron 3530 phù hợp văn phòng, học tập, mượt và bền.",
    stock: 40,
  },
  {
    brand: "HP", title: "HP Omen 16 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/e/text_d_i_3__3_23.png",
    discount: 5, price: 36990000, oldPrice: 39990000,
    category: "laptop", nation: "Mỹ", display: "16.1 inches",
    screenTech: "IPS 240Hz", ram: "16 GB", rom: "1 TB SSD",
    chip: "Intel i9-14900HX", camera: "FHD", battery: "83Wh", charging: "280W",
    description: "HP Omen 16 2024 hiệu năng cực mạnh, màn 240Hz dành cho game thủ.",
    stock: 20,
  },
  {
    brand: "Lenovo", title: "Lenovo Legion 5 Pro 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/e/text_d_i_1__4_22_1.png",
    discount: 9, price: 32490000, oldPrice: 35990000,
    category: "laptop", nation: "Trung Quốc", display: "16 inches",
    screenTech: "IPS 165Hz 500 nits", ram: "16 GB", rom: "512 GB SSD",
    chip: "Ryzen 7 7840HS", camera: "FHD", battery: "80Wh", charging: "300W",
    description: "Legion 5 Pro 2024 – hiệu năng mạnh, tản nhiệt tốt, màn 165Hz.",
    stock: 25,
  },
  {
    brand: "Acer", title: "Acer Nitro 5 2024",
    img: "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/9/h/9h25_2_1.png",
    discount: 6, price: 18990000, oldPrice: 20990000,
    category: "laptop", nation: "Đài Loan", display: "15.6 inches",
    screenTech: "IPS 144Hz", ram: "16 GB", rom: "512 GB SSD",
    chip: "Ryzen 5 7535HS", camera: "HD", battery: "57Wh", charging: "180W",
    description: "Acer Nitro 5 2024 giá tốt, hiệu năng khỏe, phù hợp game thủ phổ thông.",
    stock: 35,
  },
];

const seed = async () => {
  try {
    await sequelize.sync();
    await Product.destroy({ where: {} });
    await Product.bulkCreate(products);

    const phones  = products.filter(p => p.category === "phone").length;
    const laptops = products.filter(p => p.category === "laptop").length;
    console.log(`✅ Seeded ${products.length} products! (${phones} phones + ${laptops} laptops)`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
};

seed();