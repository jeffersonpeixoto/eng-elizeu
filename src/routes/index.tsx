import { Link, createFileRoute } from '@tanstack/react-router'
import products from '@/data/products'

export const Route = createFileRoute('/')({
  component: ProductsIndex,
})

function ProductsIndex() {
  return (
    <div className="p-5 pt-12">
      <p className="text-center text-gray-500 mb-16 max-w-xl mx-auto">
        Curated tech essentials for the modern professional.
      </p>
      <div className="max-w-7xl mx-auto">
        {products.map((product, index) => (
          <div
            key={product.id}
            className={`flex flex-col md:flex-row items-stretch gap-8 mb-32 ${
              index % 2 === 1 ? 'md:flex-row-reverse' : ''
            }`}
          >
            <div className="w-full md:w-[60%]">
              <Link
                to="/products/$productId"
                params={{
                  productId: product.id.toString(),
                }}
                className="block"
              >
                <div className="w-full aspect-[4/3]">
                  <div className="w-full h-full overflow-hidden rounded-2xl">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </Link>
            </div>

            <div className="w-full md:w-[50%] md:my-12">
              <div className="rounded-2xl p-8 border">
                <h2 className="text-2xl font-bold mb-3">{product.name}</h2>
                <p className="mb-4 leading-relaxed">
                  {product.shortDescription}
                </p>
                <div className="text-2xl font-bold">
                  ${product.price.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
