export type Listing = {
  id: string;
  name: string;
  brand: string;
  price: number;
  retailer: "Myntra" | "Nykaa Fashion";
  url: string;
  sizeStatus: "unconfirmed";
  observedAt: string | null;
};
