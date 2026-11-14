export type Shoe = {
  id: string;
  brand: string;
  name: string;
  color: string;
  article: string;
  image: string;
  price: number;
  retailer: string;
  tone: string;
  offers: {
    retailer: string;
    price: number;
    age: number;
    url: string;
    sizes: number[];
  }[];
};
export const shoes: Shoe[] = [
  {
    id: "samba-og",
    brand: "adidas",
    name: "adidas Samba OG",
    color: "Cloud White / Core Black",
    article: "B75806",
    image: "/shoes/samba.jpg",
    price: 7499,
    retailer: "Myntra",
    tone: "lilac",
    offers: [
      {
        retailer: "Myntra",
        price: 7499,
        age: 4,
        url: "https://www.myntra.com/adidas-samba",
        sizes: [6, 7, 8, 9],
      },
      {
        retailer: "Amazon.in",
        price: 8499,
        age: 7,
        url: "https://www.amazon.in/s?k=adidas+samba+og+B75806",
        sizes: [7, 8, 9, 10],
      },
      {
        retailer: "adidas India",
        price: 9999,
        age: 12,
        url: "https://www.adidas.co.in/samba-og-shoes/B75806.html",
        sizes: [6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12],
      },
    ],
  },
  {
    id: "dunk-low",
    brand: "Nike",
    name: "Nike Dunk Low Retro",
    color: "White / Black",
    article: "DD1391-100",
    image: "/shoes/dunk.jpg",
    price: 6995,
    retailer: "Flipkart",
    tone: "grey",
    offers: [
      {
        retailer: "Flipkart",
        price: 6995,
        age: 5,
        url: "https://www.flipkart.com/search?q=nike+dunk+low+retro",
        sizes: [7, 8, 9],
      },
      {
        retailer: "Nike India",
        price: 8295,
        age: 8,
        url: "https://www.nike.com/in/w?q=dunk%20low%20retro",
        sizes: [6, 7, 8, 9, 10, 11],
      },
    ],
  },
  {
    id: "nb-530",
    brand: "New Balance",
    name: "New Balance 530",
    color: "White / Natural Indigo",
    article: "MR530SG",
    image: "/shoes/nb530.jpg",
    price: 6799,
    retailer: "AJIO",
    tone: "blue",
    offers: [
      {
        retailer: "AJIO",
        price: 6799,
        age: 3,
        url: "https://www.ajio.com/search/?text=new%20balance%20530",
        sizes: [7, 8, 9],
      },
      {
        retailer: "Myntra",
        price: 7999,
        age: 10,
        url: "https://www.myntra.com/new-balance-530",
        sizes: [6, 7, 8, 9, 10],
      },
    ],
  },
  {
    id: "palermo",
    brand: "PUMA",
    name: "PUMA Palermo OG",
    color: "Archive Green / Warm White",
    article: "383011",
    image: "/shoes/palermo.jpg",
    price: 5499,
    retailer: "Amazon.in",
    tone: "green",
    offers: [
      {
        retailer: "Amazon.in",
        price: 5499,
        age: 6,
        url: "https://www.amazon.in/s?k=puma+palermo+archive+green",
        sizes: [6, 7, 8, 9],
      },
      {
        retailer: "PUMA India",
        price: 6999,
        age: 11,
        url: "https://in.puma.com/in/en/search?q=palermo",
        sizes: [6, 7, 8, 9, 10, 11],
      },
    ],
  },
];
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
