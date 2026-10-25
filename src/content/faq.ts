// FAQ content – edit freely. Shown on /faq and on the contact page.

export type FaqItem = { q: string; a: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export const FAQ: FaqGroup[] = [
  {
    title: "Ordering",
    items: [
      {
        q: "How do I place an order?",
        a: "Pick your drinks from the menu, choose size, sugar and ice, add them to your cart and check out. You don't need an account – just your name and mobile number.",
      },
      {
        q: "Is there a minimum order amount?",
        a: "Yes, the minimum order is shown in your cart. It helps us keep delivery affordable. Pickup and delivery both follow the same minimum.",
      },
      {
        q: "Can I customise my drink?",
        a: "Most drinks let you choose sugar (none, less, regular, extra) and ice (none, less, regular, extra). You can also add special instructions like “no straw” or “add black salt”.",
      },
      {
        q: "Can I order when the shop is closed?",
        a: "You can browse the menu any time, but orders can only be placed during opening hours so your drinks are always freshly made.",
      },
    ],
  },
  {
    title: "Pickup & delivery",
    items: [
      {
        q: "Where do you deliver?",
        a: "We deliver to selected pincodes near the shop. Enter your pincode in the cart or at checkout and we'll tell you straight away if we deliver there and what the delivery fee is.",
      },
      {
        q: "How long does it take?",
        a: "Pickup orders are usually ready in 15–20 minutes. Deliveries usually arrive within 35–45 minutes, depending on distance and how busy we are.",
      },
      {
        q: "Is delivery free?",
        a: "Each delivery area has a small fee, and delivery becomes free above a certain order value. The cart shows exactly how much more to add for free delivery.",
      },
      {
        q: "How do I track my order?",
        a: "Use the Track Order page with your order number (like CK-20431) and the phone number you ordered with. Orders placed on your phone also appear under My Orders.",
      },
    ],
  },
  {
    title: "Payment",
    items: [
      {
        q: "How can I pay?",
        a: "For pickup, pay at the counter by cash or UPI. For delivery, pay the delivery partner by cash or UPI (Cash on Delivery). Online payment is coming soon.",
      },
      {
        q: "Do you accept UPI?",
        a: "Yes – scan our QR code at the counter, or ask the delivery partner for the QR code.",
      },
    ],
  },
  {
    title: "Our drinks",
    items: [
      {
        q: "Do you add preservatives or concentrates?",
        a: "No. Our juices are made to order from fresh fruit. Syrups are used only in drinks that are meant to have them, like Blue Lagoon or Kala Khatta.",
      },
      {
        q: "Is your ice safe?",
        a: "Yes. All our ice is made from RO-purified water, and our counters and equipment are sanitised throughout the day.",
      },
      {
        q: "Do you have sugar-free options?",
        a: "Most drinks can be made with no added sugar – just choose “None” for sugar when you add the drink.",
      },
    ],
  },
];
