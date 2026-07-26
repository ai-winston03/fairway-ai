import { Clock3, MessageSquareText } from "lucide-react";
import { formatPrice, getAvailableMenuItems } from "@/lib/menu";

export default function MenuPage() {
  const items = getAvailableMenuItems();
  const categories = Array.from(new Set(items.map((item) => item.category)));

  return (
    <main className="menu-page">
      <section className="menu-hero">
        <div>
          <div className="eyebrow">Clubhouse menu</div>
          <h1>Order Ahead</h1>
          <p>Pick food or drinks before the round, then text your order back to FairwayAI.</p>
        </div>
        <div className="menu-instruction">
          <MessageSquareText size={18} />
          <span>Reply with item names and quantities.</span>
        </div>
      </section>

      <section className="menu-section" aria-label="Available menu items">
        {categories.map((category) => (
          <div className="menu-category" key={category}>
            <h2>{category}</h2>
            <div className="menu-card-grid">
              {items
                .filter((item) => item.category === category)
                .map((item) => (
                  <article className="menu-card" key={item.id}>
                    <div>
                      <h3>{item.name}</h3>
                      <span>{formatPrice(item.priceCents)}</span>
                    </div>
                    <small>
                      <Clock3 size={14} />
                      {item.prepMinutes} min
                    </small>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
