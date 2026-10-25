// DRAFT policy text for Cool Kick. The owner should review before launch.
import type { PolicySection } from "@/components/shop/policy-page";

export const POLICY_LAST_UPDATED = "25 October 2026";

export const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: "what-we-collect",
    title: "Information we collect",
    body: (
      <>
        <p>When you place an order or contact us we collect only what we need to serve you:</p>
        <ul>
          <li>Your name and mobile number (to prepare, confirm and hand over your order).</li>
          <li>Your delivery address and pincode, for delivery orders only.</li>
          <li>Your email address, if you choose to give it.</li>
          <li>Your order details – drinks, options, amounts and payment status.</li>
          <li>Messages you send through our contact form.</li>
        </ul>
        <p>We do not collect card numbers, UPI PINs or bank passwords. Payment is made in person by cash or UPI.</p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use it",
    body: (
      <ul>
        <li>To prepare, deliver and track your order.</li>
        <li>To contact you about your order (for example by phone or WhatsApp if we need to clarify something).</li>
        <li>To reply to your messages and feedback.</li>
        <li>To keep basic sales records required for running the business and for tax purposes.</li>
        <li>To prevent fraud and abuse (for example, too many orders from one number).</li>
      </ul>
    ),
  },
  {
    id: "device-storage",
    title: "Information stored on your device",
    body: (
      <p>
        Our website stores your cart, your recent order numbers and (if you tick “remember my details”) your contact
        details in your browser&apos;s local storage so you don&apos;t have to type them again. You can clear this at any
        time by clearing your browser data. We also use a small, secure cookie to show your order confirmation page.
        We do not use advertising cookies.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <p>
        We do not sell your information. Your name, phone number and address are shared only with our staff and our
        delivery partner so they can deliver your order. Our website is hosted with trusted service providers who store
        data securely on our behalf. We may disclose information if required by law.
      </p>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Customer phone numbers and addresses are visible only to logged-in Cool Kick staff. Our admin dashboard is
        protected by passwords and role-based access, and the website uses HTTPS encryption.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep order records for as long as needed for accounting and legal requirements (usually up to 8 years for
        tax records). Contact form messages are deleted once they are no longer needed.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your choices",
    body: (
      <p>
        You can ask us to correct or delete your personal information (except records we must keep by law) by calling,
        WhatsApping or emailing us. We&apos;ll respond within a reasonable time.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about privacy? Reach us through the details on our Contact page.</p>,
  },
];

export const TERMS_SECTIONS: PolicySection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <p>
        These terms apply when you browse the Cool Kick website or place an order for pickup or delivery. By placing an
        order you agree to them.
      </p>
    ),
  },
  {
    id: "orders",
    title: "Placing an order",
    body: (
      <ul>
        <li>Orders can be placed only during our opening hours.</li>
        <li>A minimum order amount applies and is shown in the cart.</li>
        <li>
          An order is accepted once our staff confirm it. We may reject an order (for example if an item has run out or
          the address cannot be reached); if so we will let you know.
        </li>
        <li>Please give a correct mobile number – we use it to contact you about your order.</li>
      </ul>
    ),
  },
  {
    id: "prices",
    title: "Prices & offers",
    body: (
      <ul>
        <li>All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.</li>
        <li>Prices and availability may change. The price shown at checkout is the price you pay.</li>
        <li>Only one coupon can be used per order. Coupons have conditions (minimum order, validity, limits) shown on the Offers page.</li>
        <li>We may withdraw or change offers at any time, but not for an order that has already been placed.</li>
      </ul>
    ),
  },
  {
    id: "payment",
    title: "Payment",
    body: (
      <ul>
        <li><strong>Pickup:</strong> pay at the counter by cash or UPI.</li>
        <li><strong>Delivery:</strong> Cash on Delivery – pay the delivery partner by cash or UPI.</li>
        <li>An order is marked as paid only after our staff receive the payment.</li>
      </ul>
    ),
  },
  {
    id: "pickup-delivery",
    title: "Pickup & delivery",
    body: (
      <ul>
        <li>Delivery is available only to the pincodes we serve. Delivery fees are shown before you place the order.</li>
        <li>Estimated times are a guide; busy hours, weather or traffic can cause delays.</li>
        <li>Please collect pickup orders within 30 minutes of being notified so your drink stays fresh and cold.</li>
        <li>If you are not reachable at the delivery address, we may cancel the order.</li>
      </ul>
    ),
  },
  {
    id: "food",
    title: "Food safety & allergies",
    body: (
      <p>
        Our drinks are made fresh with fruit, milk, nuts, syrups and other ingredients listed on each product. Our
        kitchen handles dairy and nuts, so we cannot guarantee any drink is free from traces of allergens. Please tell
        us about allergies in the order notes or call us before ordering. Fresh juices are best consumed within 30
        minutes.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <p>
        We do our best to keep the website accurate and available, but we can&apos;t guarantee it will always be
        error-free. Our responsibility for any order is limited to the amount paid for that order.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of India. Any disputes are subject to the courts of our city.</p>,
  },
];

export const REFUND_SECTIONS: PolicySection[] = [
  {
    id: "cancel-before",
    title: "Cancelling your order",
    body: (
      <ul>
        <li>
          You can cancel free of charge <strong>before we start preparing</strong> your order (status “Order placed” or
          “Confirmed”). Call or WhatsApp us with your order number.
        </li>
        <li>Once your order is being prepared, we can&apos;t cancel it because fresh drinks can&apos;t be resold.</li>
        <li>Since payment is collected on pickup or delivery, nothing is charged for a cancelled order.</li>
      </ul>
    ),
  },
  {
    id: "our-cancellations",
    title: "If we cancel",
    body: (
      <p>
        If an item runs out, the shop has to close unexpectedly, or we can&apos;t deliver to your address, we&apos;ll cancel
        the order and let you know. If you had already paid, we will refund the full amount.
      </p>
    ),
  },
  {
    id: "issues",
    title: "Wrong, missing or spilled items",
    body: (
      <>
        <p>
          If something is wrong with your order – a missing or wrong item, a spilled drink, or quality you&apos;re not happy
          with – tell us <strong>within 2 hours</strong> of pickup or delivery, ideally with a photo.
        </p>
        <p>Depending on the issue we will replace the drink, give store credit, or refund the affected item.</p>
      </>
    ),
  },
  {
    id: "how-refunds",
    title: "How refunds are paid",
    body: (
      <ul>
        <li>Cash payments are refunded in cash at the shop or by UPI.</li>
        <li>UPI payments are refunded to the same UPI ID, usually within 1–3 working days.</li>
        <li>Delivery fees are refunded only if the whole order is cancelled by us or never delivered.</li>
      </ul>
    ),
  },
  {
    id: "no-refund",
    title: "When refunds don't apply",
    body: (
      <ul>
        <li>Change of mind after the drink has been prepared.</li>
        <li>Delays caused by incorrect address or phone details, or the customer being unreachable.</li>
        <li>Drinks left standing for a long time after pickup or delivery.</li>
      </ul>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>For any cancellation or refund, contact us with your order number via the Contact page, phone or WhatsApp.</p>,
  },
];
