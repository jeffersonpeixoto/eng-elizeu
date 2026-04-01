export interface Product {
  id: number
  name: string
  image: string
  description: string
  shortDescription: string
  price: number
  category: string
}

const products: Array<Product> = [
  {
    id: 1,
    name: 'Wireless Noise-Cancelling Headphones',
    image: '/placeholder.png',
    description:
      'Experience pristine audio with our flagship wireless headphones. Featuring 40mm drivers, active noise cancellation, and a 30-hour battery life, these headphones deliver an immersive listening experience whether you\'re commuting, working, or relaxing at home. The premium memory-foam ear cushions ensure comfort for extended wear.',
    shortDescription: 'Premium sound, 30-hour battery, and active noise cancellation in a sleek, foldable design.',
    price: 299,
    category: 'Audio',
  },
  {
    id: 2,
    name: 'Mechanical Keyboard Pro',
    image: '/placeholder.png',
    description:
      'Engineered for professionals who demand precision and speed. This full-size mechanical keyboard features hot-swappable switches, per-key RGB lighting, and a robust aluminum chassis. The tactile feedback and satisfying click of each keystroke boosts productivity and makes every session a pleasure.',
    shortDescription: 'Hot-swappable switches, full RGB, and aircraft-grade aluminum for the ultimate typing experience.',
    price: 189,
    category: 'Peripherals',
  },
  {
    id: 3,
    name: 'Smart Desk Lamp',
    image: '/placeholder.png',
    description:
      'Illuminate your workspace intelligently. This LED desk lamp adapts its brightness and color temperature throughout the day to reduce eye strain and boost focus. Control it via touch, voice assistant, or the companion app. The built-in wireless charger keeps your devices powered without cable clutter.',
    shortDescription: 'Adaptive lighting, wireless charging, and smart home integration for a modern desk setup.',
    price: 89,
    category: 'Accessories',
  },
  {
    id: 4,
    name: 'Portable SSD 1TB',
    image: '/placeholder.png',
    description:
      'Take your data anywhere with confidence. This pocket-sized SSD delivers read speeds up to 1050MB/s and write speeds up to 1000MB/s, making it the fastest external drive in its class. Drop-resistant and water-resistant, it\'s built to withstand the demands of life on the go. Compatible with USB-C and USB-A devices.',
    shortDescription: 'Ultra-fast 1050MB/s read speed, rugged design, and 1TB storage in a palm-sized package.',
    price: 129,
    category: 'Storage',
  },
]

export default products
