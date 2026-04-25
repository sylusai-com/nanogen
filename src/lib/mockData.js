// Phase 2 stub data: drives dashboard and admin views until Supabase is wired.

const STYLES = ["Modern", "Minimal", "Cyberpunk", "Editorial", "Playful", "Corporate"];
const ASPECTS = ["16:9", "1:1", "4:5", "9:16"];
const MODELS = [
  { id: "sdxl", label: "Stable Diffusion XL" },
  { id: "imagen", label: "Imagen 3" },
  { id: "flux", label: "Flux Pro" },
];

const GRADIENTS = [
  "linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #082f49 100%)",
  "linear-gradient(135deg, #1e1b4b 0%, #0c0a35 50%, #134e4a 100%)",
  "linear-gradient(135deg, #831843 0%, #1e1b4b 50%, #18181b 100%)",
  "linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
  "linear-gradient(135deg, #0c1a3a 0%, #1e293b 50%, #082f49 100%)",
  "linear-gradient(135deg, #4a044e 0%, #1e1b4b 50%, #082f49 100%)",
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const TITLES = [
  "Launch banner — Series B announcement",
  "Cyberpunk SaaS hero",
  "Holiday sale promo",
  "Editorial fintech reveal",
  "Product update — v2.0",
  "Webinar invite hero",
  "Black Friday header",
  "Onboarding splash",
  "Newsletter banner — March",
  "Podcast episode card",
  "Conference event hero",
  "Mobile app launch",
];

export function listBanners() {
  return TITLES.map((title, i) => ({
    id: `bn_${1000 + i}`,
    title,
    style: pick(STYLES, i),
    aspect: pick(ASPECTS, i),
    score: 70 + ((i * 17) % 30),
    model: pick(MODELS, i).id,
    modelLabel: pick(MODELS, i).label,
    gradient: pick(GRADIENTS, i),
    createdAt: daysAgo(i + 1),
    favourite: i % 5 === 0,
  }));
}

export function getBanner(id) {
  return listBanners().find((b) => b.id === id) || null;
}

export function recentBanners(n = 6) {
  return listBanners().slice(0, n);
}

const NAMES = [
  "Aman Bhatt", "Lina Park", "Rahul Mehta", "Sara Cohen", "Devon Walsh",
  "Yuki Tanaka", "Maya Iyer", "Marcus Reyes", "Priya Singh", "Tom Bauer",
  "Noor Sayed", "Ines Garcia",
];

export function listUsers() {
  return NAMES.map((name, i) => {
    const handle = name.toLowerCase().replace(/\s+/g, ".");
    return {
      id: `usr_${100 + i}`,
      name,
      email: `${handle}@${i % 4 === 0 ? "nanogen.io" : "example.com"}`,
      role: i === 0 ? "admin" : "user",
      banners: 4 + ((i * 7) % 18),
      avgScore: 78 + ((i * 5) % 20),
      lastActive: daysAgo((i * 2) % 14),
      status: i % 3 === 0 ? "online" : i % 3 === 1 ? "away" : "offline",
      plan: i % 4 === 0 ? "pro" : "free",
    };
  });
}

export function modelMetrics() {
  return [
    { id: "sdxl", label: "Stable Diffusion XL", provider: "Stability AI", runs: 8421, avgScore: 84, p50ms: 2120, success: 0.97, share: 0.34 },
    { id: "imagen", label: "Imagen 3", provider: "Google", runs: 7902, avgScore: 89, p50ms: 1980, success: 0.98, share: 0.31 },
    { id: "flux", label: "Flux Pro", provider: "Black Forest Labs", runs: 6210, avgScore: 81, p50ms: 2640, success: 0.95, share: 0.25 },
    { id: "dalle", label: "DALL·E 3", provider: "OpenAI", runs: 2511, avgScore: 87, p50ms: 3010, success: 0.93, share: 0.10 },
  ];
}

// Daily generation counts for the last 14 days, plus running average score
export function dailyActivity(days = 14) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const seed = (i * 13 + 7) % 100;
    out.push({
      date: d.toISOString().slice(5, 10),
      generations: 220 + (seed * 6) + (i % 3 === 0 ? 80 : 0),
      avgScore: 80 + (seed % 12),
    });
  }
  return out;
}

export function adminKpis() {
  return [
    { id: "users", label: "Active users", value: "1,284", delta: "+12.4%", positive: true },
    { id: "banners", label: "Banners generated", value: "24,917", delta: "+8.1%", positive: true },
    { id: "score", label: "Avg quality score", value: "86.2", delta: "+1.6", positive: true },
    { id: "latency", label: "P50 latency", value: "2.31s", delta: "-180ms", positive: true },
  ];
}

export function recentOutputs(n = 8) {
  return listBanners().slice(0, n).map((b, i) => ({
    ...b,
    user: NAMES[i % NAMES.length],
  }));
}
