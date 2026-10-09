# DealSpark Everyday Essentials — storefront preview

This folder is a polished, responsive storefront preview. It is deliberately not presented as a live checkout.

## Publish gate

A product appears only when its catalog record includes all of the following:
- `status: "approved"`
- verified product title and image URL
- customer price and product/checkout URL
- `costVerified: true`
- `shippingVerified: true`
- `stockVerified: true`

The catalog is intentionally empty until supplier cost, destination-specific shipping, stock, delivery estimate, return process and a viable margin are confirmed. Do not add sample or guessed prices to make the grid look full.

## Preview

Open `index.html` locally, or enable GitHub Pages for this repository/folder only if appropriate for the public site. A GitHub Pages site cannot securely handle orders, secrets, payments or supplier fulfillment. The live storefront checkout should remain on the chosen commerce platform.

## Brand direction

Warm editorial minimalism: forest green, soft cream, lime accent, roomy layout, accessible contrast, mobile-first responsive cards, and clear product-value standards.
