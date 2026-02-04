export interface ScrapedProduct {
    sku: string;
    title: string;
    price: string;
    rating: string;
    reviews: string;
    description: string;
}

export interface ProductData {
    SKU: string;
    Source: string;
    Title: string;
    Description: string;
    Price: string;
    'Number of Reviews and rating': string;
}

export interface SKUItem {
    Type: 'Amazon' | 'Walmart';
    SKU: string;
}

export interface SKUList {
    skus: SKUItem[];
}
