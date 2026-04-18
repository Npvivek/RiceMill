import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  withCredentials: true,
});

export const fmt = {
  currency: (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n),
  number: (n: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n),
  date: (d: string | Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)),
  qtl: (n: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n)} qtl`,
};
