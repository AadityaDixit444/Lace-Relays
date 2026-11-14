import catalogData from "@/data/catalog.json";
import type { StyleId, Height } from "./styles";
export type Shoe = {
  id: string;
  brand: string;
  name: string;
  color: string;
  article: string;
  image: string;
  price?: number;
  retailer?: string;
  referenceUrl?: string;
  tone: string;
  category: "Sneakers";
  styles: StyleId[];
  height: Height;
  edition: string;
  range: "adult" | "kids";
  offers: {
    retailer: string;
    price: number;
    age: number;
    url: string;
    sizes: number[];
  }[];
};
export const shoes = catalogData as Shoe[];
export const previewShoes = shoes
  .slice(0, 4)
  .filter(
    (shoe): shoe is Shoe & { price: number; retailer: string } =>
      typeof shoe.price === "number" &&
      shoe.price > 0 &&
      typeof shoe.retailer === "string",
  );
export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
export const ukSizes = [
  3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5,
  12,
];
