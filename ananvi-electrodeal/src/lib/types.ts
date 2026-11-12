export type ProductCondition =
  | 'brand-new-sealed'
  | 'open-box'
  | 'certified-refurbished'
  | 'professionally-refurbished'
  | 'pre-owned-excellent'
  | 'pre-owned-good'
  | 'pre-owned-fair'
  | 'unverified';

export type CouponStatus = 'verified' | 'recently-verified' | 'unverified' | 'expired' | 'failed';

export interface Retailer {
  id: string;
  name: string;
  logo: string;
  url: string;
  trustScore: number;
  verified: boolean;
  affiliateEnabled: boolean;
}

export interface ProductOffer {
  id: string;
  retailer: Retailer;
  price: number;
  originalPrice: number;
  currency: 'AED';
  discount: number;
  condition: ProductCondition;
  deliveryFee: number;
  deliveryDays: number;
  warranty: string;
  returnDays: number;
  availability: 'in-stock' | 'limited' | 'out-of-stock';
  url: string;
  lastChecked: Date;
  couponCode?: string;
  cashback?: number;
  sponsored: boolean;
}

export interface ProductSpec {
  name: string;
  value: string;
  unit?: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  sku: string;
  category: ProductCategory;
  subcategory: string;
  imageUrl: string;
  images: string[];
  description: string;
  specs: ProductSpec[];
  offers: ProductOffer[];
  rating: number;
  reviewCount: number;
  priceHistory: PricePoint[];
  relatedProducts: string[];
  tags: string[];
  aiResearchSummary?: string;
}

export type ProductCategory =
  | 'smartphones'
  | 'laptops'
  | 'gaming'
  | 'televisions'
  | 'cameras'
  | 'audio'
  | 'wearables'
  | 'smart-home'
  | 'accessories'
  | 'tablets'
  | 'computers';

export interface PricePoint {
  date: Date;
  price: number;
  retailerId: string;
}

export interface Coupon {
  id: string;
  retailer: Retailer;
  code: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  minimumPurchase: number;
  eligibleCategories: string[];
  restrictions: string[];
  expiryDate: Date;
  terms: string;
  sourceUrl: string;
  lastVerified: Date;
  status: CouponStatus;
  successRate: number;
}

export interface AIResearchReport {
  id: string;
  query: string;
  products: Product[];
  recommendations: {
    type: 'best-overall' | 'best-budget' | 'best-performance' | 'best-value' | 'best-premium' | 'best-refurbished';
    product: Product;
    reason: string;
    pros: string[];
    cons: string[];
  }[];
  summary: string;
  generatedAt: Date;
  sources: string[];
}

export interface DealAlert {
  id: string;
  productId: string;
  userId: string;
  targetPrice: number;
  currentPrice: number;
  status: 'active' | 'triggered' | 'expired';
  createdAt: Date;
}

export interface SearchFilters {
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  brand?: string[];
  condition?: ProductCondition[];
  retailer?: string[];
  sortBy?: 'lowest-price' | 'best-value' | 'best-warranty' | 'seller-reliability' | 'fastest-delivery';
  inStockOnly?: boolean;
}
