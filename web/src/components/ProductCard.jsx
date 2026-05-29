import React from 'react';
import { Link } from 'react-router-dom';
import {
  formatINR,
  getProductImage,
  getProductRating,
  getStockStatus,
} from '../lib/productPresentation';

export default function ProductCard({
  product,
  quantity = 0,
  onAdd,
  onDec,
  onOrder,
  showStore = false,
  storeHref,
  actionLabel = 'Add to cart',
  orderLabel = 'Order now',
}) {
  const rating = getProductRating(product);
  const stock = getStockStatus(product);
  const category = product.categoryName || 'General';
  const image = getProductImage(product);
  const canBuy = product.inStock && Number(product.stockQuantity || 0) > 0;

  return (
    <article className="listing-card" data-product-card>
      <div className="listing-media">
        <img src={image} alt={product.name} loading="lazy" draggable="false" />
        <div className="listing-media-shade" />
        <span className={`stock-badge ${stock.tone}`}>{stock.label}</span>
        <div className="listing-card-actions" aria-label="Quick actions">
          {storeHref && (
            <Link className="quick-action" to={storeHref} aria-label={`View ${product.store?.storeName || 'store'}`}>
              View
            </Link>
          )}
          {onOrder && canBuy && (
            <button className="quick-action" type="button" onClick={() => onOrder(product)}>
              Buy
            </button>
          )}
        </div>
      </div>

      <div className="listing-body">
        <div className="listing-meta">
          <span>{category}</span>
          <span aria-label={`${rating.value} out of 5 stars`}>
            ★ {rating.value}
          </span>
        </div>

        <h3>{product.name}</h3>

        {showStore && product.store && (
          <p className="listing-store">
            {product.store.storeName}
            {product.store.city ? ` · ${product.store.city}` : ''}
          </p>
        )}

        <div className="listing-commercials">
          <strong>{formatINR(product.price)}</strong>
          <span>{stock.helper}</span>
        </div>

        <div className="listing-footer">
          {quantity > 0 ? (
            <div className="listing-qty" aria-label={`${quantity} in cart`}>
              <button type="button" onClick={() => onDec(product.id)} aria-label={`Remove one ${product.name}`}>
                -
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => onAdd(product)}
                disabled={quantity >= Number(product.stockQuantity || 0)}
                aria-label={`Add one ${product.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="listing-primary"
              onClick={() => onAdd(product)}
              disabled={!canBuy}
            >
              {canBuy ? actionLabel : 'Sold out'}
            </button>
          )}

          {onOrder && (
            <button
              type="button"
              className="listing-secondary"
              onClick={() => onOrder(product)}
              disabled={!canBuy}
            >
              {orderLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
