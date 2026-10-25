// Sample menu for Cool Kick. Prices are in rupees here and converted to paise in seed.ts.
// The owner can edit everything later from the admin dashboard.

export type SeedProduct = {
  name: string;
  description: string;
  ingredients: string[];
  tags?: ("BESTSELLER" | "NEW" | "SEASONAL")[];
  prices: [small: number, medium: number, large: number];
  sugar?: boolean;
  ice?: boolean;
  recipe?: Record<string, number>; // ingredient name -> quantity per drink (medium)
};

export type SeedCategory = {
  name: string;
  slug: string;
  description: string;
  color: string; // used for placeholder art
  products: SeedProduct[];
};

export const categories: SeedCategory[] = [
  {
    name: "Fresh Fruit Juices",
    slug: "fresh-fruit-juices",
    description: "Pressed to order from the day's freshest fruit.",
    color: "#ff8a3d",
    products: [
      {
        name: "Mixed Fruit Juice",
        description: "A sunny blend of seasonal fruits, pressed fresh.",
        ingredients: ["Apple", "Orange", "Pineapple", "Pomegranate"],
        tags: ["BESTSELLER"],
        prices: [60, 80, 100],
        recipe: { Apple: 0.1, Orange: 0.15, Pineapple: 0.1, Sugar: 0.015, Ice: 0.1 },
      },
      {
        name: "Pomegranate Juice",
        description: "Ruby-red anar juice, rich and naturally sweet.",
        ingredients: ["Pomegranate"],
        prices: [80, 100, 130],
        recipe: { Pomegranate: 0.35, Ice: 0.1 },
      },
      {
        name: "Sweet Lime (Mosambi) Juice",
        description: "Light, refreshing mosambi – the classic summer cooler.",
        ingredients: ["Sweet Lime"],
        prices: [50, 70, 90],
        recipe: { "Sweet Lime": 0.4, Sugar: 0.01, Ice: 0.1 },
      },
      {
        name: "Apple Juice",
        description: "Crisp Kashmiri apples pressed to a smooth juice.",
        ingredients: ["Apple"],
        prices: [70, 90, 120],
        recipe: { Apple: 0.35, Ice: 0.1 },
      },
    ],
  },
  {
    name: "Ice Juices",
    slug: "ice-juices",
    description: "Our signature slushy ice juices – the Cool Kick special.",
    color: "#22c3e6",
    products: [
      {
        name: "Blue Lagoon Ice Juice",
        description: "Blue curacao syrup, lemon and crushed ice. Our most-photographed drink.",
        ingredients: ["Blue Curacao Syrup", "Lemon", "Soda", "Crushed Ice"],
        tags: ["BESTSELLER"],
        prices: [50, 70, 90],
        recipe: { "Blue Curacao Syrup": 0.03, Lemon: 1, Soda: 0.15, Ice: 0.2 },
      },
      {
        name: "Kala Khatta Ice Juice",
        description: "Tangy-sweet kala khatta with a pinch of black salt over crushed ice.",
        ingredients: ["Kala Khatta Syrup", "Black Salt", "Lemon", "Crushed Ice"],
        prices: [40, 60, 80],
        recipe: { "Kala Khatta Syrup": 0.04, Lemon: 0.5, Ice: 0.2 },
      },
      {
        name: "Rose Ice Juice",
        description: "Fragrant rose syrup with basil seeds and crushed ice.",
        ingredients: ["Rose Syrup", "Basil Seeds", "Crushed Ice"],
        tags: ["NEW"],
        prices: [45, 65, 85],
        recipe: { "Rose Syrup": 0.04, Ice: 0.2 },
      },
      {
        name: "Strawberry Ice Juice",
        description: "Strawberry crush blended with ice into a frosty slush.",
        ingredients: ["Strawberry Crush", "Crushed Ice"],
        prices: [55, 75, 95],
        recipe: { "Strawberry Crush": 0.05, Ice: 0.2 },
      },
    ],
  },
  {
    name: "Mango Juice",
    slug: "mango-juice",
    description: "Alphonso and Kesar mango, thick and golden.",
    color: "#ffb703",
    products: [
      {
        name: "Alphonso Mango Juice",
        description: "Pure Ratnagiri Alphonso pulp – thick, sweet and golden.",
        ingredients: ["Alphonso Mango"],
        tags: ["BESTSELLER", "SEASONAL"],
        prices: [80, 110, 140],
        recipe: { "Mango Pulp": 0.2, Sugar: 0.01, Ice: 0.1 },
      },
      {
        name: "Mango Ice Juice",
        description: "Mango pulp blended with crushed ice for a frosty mango slush.",
        ingredients: ["Mango Pulp", "Crushed Ice"],
        prices: [60, 80, 100],
        recipe: { "Mango Pulp": 0.15, Ice: 0.2 },
      },
      {
        name: "Mango Mastani",
        description: "Pune's favourite – mango shake topped with ice cream and dry fruits.",
        ingredients: ["Mango Pulp", "Milk", "Vanilla Ice Cream", "Dry Fruits"],
        tags: ["BESTSELLER"],
        prices: [100, 130, 160],
        recipe: { "Mango Pulp": 0.15, Milk: 0.15, "Vanilla Ice Cream": 0.06, "Dry Fruits": 0.01 },
      },
    ],
  },
  {
    name: "Orange Juice",
    slug: "orange-juice",
    description: "Nagpur oranges, squeezed fresh.",
    color: "#fb8500",
    products: [
      {
        name: "Fresh Orange Juice",
        description: "Freshly squeezed Nagpur oranges, nothing added.",
        ingredients: ["Orange"],
        tags: ["BESTSELLER"],
        prices: [60, 80, 100],
        sugar: true,
        recipe: { Orange: 0.45, Ice: 0.1 },
      },
      {
        name: "Orange Ice Juice",
        description: "Orange juice over crushed ice with a hint of mint.",
        ingredients: ["Orange", "Mint", "Crushed Ice"],
        prices: [55, 75, 95],
        recipe: { Orange: 0.3, Mint: 0.005, Ice: 0.2 },
      },
      {
        name: "Orange Carrot Juice",
        description: "Orange and carrot – a vitamin-packed duo.",
        ingredients: ["Orange", "Carrot", "Ginger"],
        prices: [65, 85, 105],
        recipe: { Orange: 0.25, Carrot: 0.15, Ice: 0.1 },
      },
    ],
  },
  {
    name: "Watermelon Juice",
    slug: "watermelon-juice",
    description: "Juicy watermelon, the ultimate thirst quencher.",
    color: "#ef476f",
    products: [
      {
        name: "Watermelon Juice",
        description: "Pure watermelon juice, pressed fresh.",
        ingredients: ["Watermelon"],
        tags: ["BESTSELLER"],
        prices: [40, 60, 80],
        recipe: { Watermelon: 0.5, Ice: 0.1 },
      },
      {
        name: "Watermelon Mint Cooler",
        description: "Watermelon with fresh mint and a squeeze of lime.",
        ingredients: ["Watermelon", "Mint", "Lemon"],
        prices: [50, 70, 90],
        recipe: { Watermelon: 0.45, Mint: 0.005, Lemon: 0.5, Ice: 0.1 },
      },
      {
        name: "Watermelon Ice Juice",
        description: "Watermelon blended with crushed ice into a pink slush.",
        ingredients: ["Watermelon", "Crushed Ice"],
        prices: [45, 65, 85],
        recipe: { Watermelon: 0.4, Ice: 0.2 },
      },
    ],
  },
  {
    name: "Pineapple Juice",
    slug: "pineapple-juice",
    description: "Tropical pineapple, sweet and tangy.",
    color: "#f4d35e",
    products: [
      {
        name: "Pineapple Juice",
        description: "Freshly pressed pineapple – sweet, tangy and tropical.",
        ingredients: ["Pineapple"],
        prices: [50, 70, 90],
        recipe: { Pineapple: 0.4, Sugar: 0.01, Ice: 0.1 },
      },
      {
        name: "Pineapple Mint Juice",
        description: "Pineapple with mint leaves and a pinch of chaat masala.",
        ingredients: ["Pineapple", "Mint", "Chaat Masala"],
        prices: [55, 75, 95],
        recipe: { Pineapple: 0.35, Mint: 0.005, Ice: 0.1 },
      },
      {
        name: "Pina Colada (Virgin)",
        description: "Pineapple and coconut cream, blended smooth.",
        ingredients: ["Pineapple", "Coconut Cream"],
        tags: ["NEW"],
        prices: [90, 120, 150],
        recipe: { Pineapple: 0.25, "Coconut Cream": 0.05, Ice: 0.15 },
      },
    ],
  },
  {
    name: "Grape Juice",
    slug: "grape-juice",
    description: "Nashik grapes – black and green.",
    color: "#7b2cbf",
    products: [
      {
        name: "Black Grape Juice",
        description: "Nashik black grapes with a hint of black salt.",
        ingredients: ["Black Grapes", "Black Salt"],
        tags: ["SEASONAL"],
        prices: [60, 80, 100],
        recipe: { "Black Grapes": 0.3, Ice: 0.1 },
      },
      {
        name: "Green Grape Juice",
        description: "Light and refreshing green grape juice.",
        ingredients: ["Green Grapes"],
        prices: [55, 75, 95],
        recipe: { "Green Grapes": 0.3, Ice: 0.1 },
      },
      {
        name: "Grape Ice Juice",
        description: "Grape juice blended with crushed ice and lemon.",
        ingredients: ["Black Grapes", "Lemon", "Crushed Ice"],
        prices: [60, 80, 100],
        recipe: { "Black Grapes": 0.25, Lemon: 0.5, Ice: 0.2 },
      },
    ],
  },
  {
    name: "Lemon Juice",
    slug: "lemon-juice",
    description: "Nimbu pani, shikanji and soda – desi classics.",
    color: "#c7e83d",
    products: [
      {
        name: "Fresh Lime Water",
        description: "Classic nimbu pani – sweet, salted or both.",
        ingredients: ["Lemon", "Sugar", "Black Salt"],
        prices: [30, 40, 50],
        recipe: { Lemon: 1, Sugar: 0.02, Ice: 0.1 },
      },
      {
        name: "Masala Shikanji",
        description: "Lemonade spiced with roasted jeera and black salt.",
        ingredients: ["Lemon", "Roasted Jeera", "Black Salt", "Mint"],
        tags: ["BESTSELLER"],
        prices: [40, 50, 60],
        recipe: { Lemon: 1, Sugar: 0.02, Mint: 0.003, Ice: 0.1 },
      },
      {
        name: "Fresh Lime Soda",
        description: "Lime and chilled soda, sweet or salted.",
        ingredients: ["Lemon", "Soda"],
        prices: [40, 55, 70],
        recipe: { Lemon: 1, Soda: 0.2, Sugar: 0.015, Ice: 0.1 },
      },
      {
        name: "Ginger Lemon Cooler",
        description: "Zesty lemon with fresh ginger and honey.",
        ingredients: ["Lemon", "Ginger", "Honey"],
        prices: [45, 60, 75],
        recipe: { Lemon: 1, Ginger: 0.01, Ice: 0.1 },
      },
    ],
  },
  {
    name: "Mojitos",
    slug: "mojitos",
    description: "Minty, fizzy, non-alcoholic mojitos.",
    color: "#2ec4b6",
    products: [
      {
        name: "Virgin Mint Mojito",
        description: "Fresh mint, lime and soda – the original.",
        ingredients: ["Mint", "Lemon", "Soda", "Sugar"],
        tags: ["BESTSELLER"],
        prices: [70, 90, 110],
        recipe: { Mint: 0.008, Lemon: 1, Soda: 0.2, Sugar: 0.02, Ice: 0.15 },
      },
      {
        name: "Blue Curacao Mojito",
        description: "Our electric-blue mojito with mint and lime.",
        ingredients: ["Blue Curacao Syrup", "Mint", "Lemon", "Soda"],
        prices: [80, 100, 120],
        recipe: { "Blue Curacao Syrup": 0.03, Mint: 0.006, Lemon: 1, Soda: 0.2, Ice: 0.15 },
      },
      {
        name: "Watermelon Mojito",
        description: "Watermelon chunks muddled with mint and lime.",
        ingredients: ["Watermelon", "Mint", "Lemon", "Soda"],
        tags: ["NEW"],
        prices: [80, 100, 120],
        recipe: { Watermelon: 0.2, Mint: 0.006, Lemon: 1, Soda: 0.15, Ice: 0.15 },
      },
      {
        name: "Green Apple Mojito",
        description: "Green apple syrup, mint, lime and soda.",
        ingredients: ["Green Apple Syrup", "Mint", "Lemon", "Soda"],
        prices: [80, 100, 120],
        recipe: { "Green Apple Syrup": 0.03, Mint: 0.006, Lemon: 1, Soda: 0.2, Ice: 0.15 },
      },
    ],
  },
  {
    name: "Milkshakes",
    slug: "milkshakes",
    description: "Thick, creamy shakes made with chilled milk.",
    color: "#8d5b4c",
    products: [
      {
        name: "Cold Coffee",
        description: "Strong, creamy cold coffee with a scoop of ice cream.",
        ingredients: ["Milk", "Coffee", "Vanilla Ice Cream", "Sugar"],
        tags: ["BESTSELLER"],
        prices: [80, 100, 130],
        ice: true,
        recipe: { Milk: 0.2, Coffee: 0.008, "Vanilla Ice Cream": 0.05, Sugar: 0.02 },
      },
      {
        name: "Chocolate Shake",
        description: "Rich chocolate shake with chocolate sauce drizzle.",
        ingredients: ["Milk", "Chocolate Syrup", "Vanilla Ice Cream"],
        prices: [90, 110, 140],
        recipe: { Milk: 0.2, "Chocolate Syrup": 0.03, "Vanilla Ice Cream": 0.05 },
      },
      {
        name: "Strawberry Shake",
        description: "Pink, creamy and fruity.",
        ingredients: ["Milk", "Strawberry Crush", "Vanilla Ice Cream"],
        prices: [90, 110, 140],
        recipe: { Milk: 0.2, "Strawberry Crush": 0.04, "Vanilla Ice Cream": 0.05 },
      },
      {
        name: "Oreo Shake",
        description: "Crushed Oreo cookies blended into a thick shake.",
        ingredients: ["Milk", "Oreo Biscuits", "Vanilla Ice Cream"],
        tags: ["NEW"],
        prices: [100, 130, 160],
        recipe: { Milk: 0.2, "Oreo Biscuits": 4, "Vanilla Ice Cream": 0.05 },
      },
    ],
  },
  {
    name: "Smoothies",
    slug: "smoothies",
    description: "Thick fruit smoothies with yoghurt.",
    color: "#e76f51",
    products: [
      {
        name: "Banana Oats Smoothie",
        description: "Banana, oats, honey and yoghurt – breakfast in a glass.",
        ingredients: ["Banana", "Oats", "Honey", "Curd"],
        prices: [90, 110, 140],
        ice: false,
        recipe: { Banana: 1, Curd: 0.1, Milk: 0.1 },
      },
      {
        name: "Berry Blast Smoothie",
        description: "Strawberry and mixed berries with yoghurt.",
        ingredients: ["Strawberry Crush", "Mixed Berries", "Curd"],
        tags: ["NEW"],
        prices: [110, 140, 170],
        recipe: { "Strawberry Crush": 0.03, Curd: 0.12, Ice: 0.1 },
      },
      {
        name: "Mango Smoothie",
        description: "Mango pulp and yoghurt, blended thick.",
        ingredients: ["Mango Pulp", "Curd", "Honey"],
        prices: [100, 130, 160],
        recipe: { "Mango Pulp": 0.15, Curd: 0.12, Ice: 0.1 },
      },
    ],
  },
  {
    name: "Falooda",
    slug: "falooda",
    description: "Layered falooda with sabja, vermicelli and ice cream.",
    color: "#ff6fa8",
    products: [
      {
        name: "Royal Rose Falooda",
        description: "Rose milk, falooda sev, sabja seeds, jelly and a scoop of ice cream.",
        ingredients: ["Milk", "Rose Syrup", "Falooda Sev", "Basil Seeds", "Vanilla Ice Cream"],
        tags: ["BESTSELLER"],
        prices: [100, 130, 160],
        sugar: false,
        ice: false,
        recipe: { Milk: 0.2, "Rose Syrup": 0.03, "Vanilla Ice Cream": 0.06 },
      },
      {
        name: "Kesar Pista Falooda",
        description: "Saffron milk with pistachios, falooda sev and kulfi.",
        ingredients: ["Milk", "Saffron", "Pistachio", "Falooda Sev", "Kulfi"],
        prices: [120, 150, 180],
        sugar: false,
        ice: false,
        recipe: { Milk: 0.2, "Dry Fruits": 0.015 },
      },
      {
        name: "Mango Falooda",
        description: "Mango pulp layered with falooda, sabja and mango ice cream.",
        ingredients: ["Mango Pulp", "Milk", "Falooda Sev", "Basil Seeds"],
        tags: ["SEASONAL"],
        prices: [110, 140, 170],
        sugar: false,
        ice: false,
        recipe: { "Mango Pulp": 0.1, Milk: 0.15, "Vanilla Ice Cream": 0.06 },
      },
    ],
  },
  {
    name: "Seasonal Specials",
    slug: "seasonal-specials",
    description: "Limited-time drinks that change with the season.",
    color: "#06d6a0",
    products: [
      {
        name: "Kokum Sharbat",
        description: "Konkan kokum cooler – tangy, cooling and caffeine-free.",
        ingredients: ["Kokum", "Sugar", "Roasted Jeera"],
        tags: ["SEASONAL"],
        prices: [40, 55, 70],
        recipe: { Sugar: 0.02, Ice: 0.1 },
      },
      {
        name: "Sugarcane Ice Juice",
        description: "Fresh sugarcane juice with ginger and lemon over ice.",
        ingredients: ["Sugarcane", "Ginger", "Lemon"],
        tags: ["SEASONAL", "BESTSELLER"],
        prices: [30, 40, 50],
        sugar: false,
        recipe: { Lemon: 0.5, Ginger: 0.005, Ice: 0.15 },
      },
      {
        name: "Tender Coconut Cooler",
        description: "Tender coconut water with soft malai bits.",
        ingredients: ["Tender Coconut"],
        tags: ["SEASONAL"],
        prices: [60, 80, 100],
        sugar: false,
        recipe: { Ice: 0.1 },
      },
    ],
  },
  {
    name: "Combos & Offers",
    slug: "combos-offers",
    description: "Value combos for friends and family.",
    color: "#3a86ff",
    products: [
      {
        name: "Ice Juice Duo",
        description: "Any two medium ice juices – perfect for sharing.",
        ingredients: ["2 × Medium Ice Juice"],
        prices: [99, 120, 150],
        recipe: { "Blue Curacao Syrup": 0.03, "Kala Khatta Syrup": 0.04, Ice: 0.4 },
      },
      {
        name: "Family Juice Pack",
        description: "Four fresh fruit juices of your choice.",
        ingredients: ["4 × Fresh Juice"],
        tags: ["BESTSELLER"],
        prices: [220, 280, 340],
        recipe: { Orange: 0.6, Watermelon: 0.6, Pineapple: 0.4, Ice: 0.4 },
      },
      {
        name: "Mojito Party Pack",
        description: "Three mojitos – mint, blue curacao and watermelon.",
        ingredients: ["3 × Mojito"],
        tags: ["NEW"],
        prices: [199, 249, 299],
        recipe: { Mint: 0.02, Lemon: 3, Soda: 0.6, Ice: 0.45 },
      },
    ],
  },
];

export const ingredients: {
  name: string;
  unit: "KG" | "LITRE" | "PIECE" | "GRAM" | "ML";
  stock: number;
  low: number;
}[] = [
  { name: "Apple", unit: "KG", stock: 12, low: 3 },
  { name: "Orange", unit: "KG", stock: 25, low: 5 },
  { name: "Pineapple", unit: "KG", stock: 15, low: 4 },
  { name: "Pomegranate", unit: "KG", stock: 8, low: 3 },
  { name: "Sweet Lime", unit: "KG", stock: 20, low: 5 },
  { name: "Watermelon", unit: "KG", stock: 40, low: 10 },
  { name: "Black Grapes", unit: "KG", stock: 6, low: 3 },
  { name: "Green Grapes", unit: "KG", stock: 5, low: 3 },
  { name: "Mango Pulp", unit: "KG", stock: 18, low: 5 },
  { name: "Carrot", unit: "KG", stock: 6, low: 2 },
  { name: "Banana", unit: "PIECE", stock: 36, low: 12 },
  { name: "Lemon", unit: "PIECE", stock: 200, low: 50 },
  { name: "Mint", unit: "KG", stock: 1.5, low: 0.5 },
  { name: "Ginger", unit: "KG", stock: 1, low: 0.3 },
  { name: "Milk", unit: "LITRE", stock: 30, low: 10 },
  { name: "Curd", unit: "KG", stock: 5, low: 2 },
  { name: "Vanilla Ice Cream", unit: "KG", stock: 6, low: 2 },
  { name: "Coffee", unit: "KG", stock: 0.5, low: 0.2 },
  { name: "Chocolate Syrup", unit: "LITRE", stock: 2, low: 0.5 },
  { name: "Strawberry Crush", unit: "LITRE", stock: 3, low: 1 },
  { name: "Rose Syrup", unit: "LITRE", stock: 3, low: 1 },
  { name: "Blue Curacao Syrup", unit: "LITRE", stock: 0.4, low: 1 },
  { name: "Kala Khatta Syrup", unit: "LITRE", stock: 3, low: 1 },
  { name: "Green Apple Syrup", unit: "LITRE", stock: 2, low: 0.5 },
  { name: "Coconut Cream", unit: "LITRE", stock: 1.5, low: 0.5 },
  { name: "Dry Fruits", unit: "KG", stock: 1.2, low: 0.3 },
  { name: "Oreo Biscuits", unit: "PIECE", stock: 0, low: 24 },
  { name: "Soda", unit: "LITRE", stock: 24, low: 6 },
  { name: "Sugar", unit: "KG", stock: 15, low: 5 },
  { name: "Ice", unit: "KG", stock: 80, low: 20 },
];

export const reviews = [
  { customerName: "Priya S.", rating: 5, comment: "Best Blue Lagoon in town! Super chilled and not too sweet. My go-to after college." },
  { customerName: "Rahul M.", rating: 5, comment: "Mango Mastani is unreal – thick, creamy and loaded with dry fruits. Worth every rupee." },
  { customerName: "Ananya K.", rating: 4, comment: "Ordered on a hot afternoon and it arrived ice cold in 25 minutes. Watermelon mojito was perfect." },
  { customerName: "Vikram P.", rating: 5, comment: "Clean shop, friendly staff and the masala shikanji tastes just like home." },
  { customerName: "Sneha R.", rating: 5, comment: "Royal Rose Falooda is a whole dessert. Kids loved it!" },
  { customerName: "Arjun T.", rating: 4, comment: "Great cold coffee and quick pickup. Would love more seating space." },
];
