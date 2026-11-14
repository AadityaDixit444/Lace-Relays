export const looks = [
  { id: "terrace", label: "Terrace / Samba-style", image: "/shoes/samba.jpg" },
  { id: "retro-court", label: "Retro Court", image: "/shoes/dunk.jpg" },
  { id: "skate", label: "Skate", image: "/shoes/skate.jpg" },
  { id: "retro-running", label: "Retro Running", image: "/shoes/nb530.jpg" },
  {
    id: "basketball",
    label: "Basketball-inspired",
    image: "/shoes/basketball.jpg",
  },
  {
    id: "minimal-leather",
    label: "Minimal Leather",
    image: "/shoes/minimal.jpg",
  },
  { id: "trail", label: "Trail-inspired", image: "/shoes/trail.jpg" },
] as const;
export type StyleId = (typeof looks)[number]["id"];
export type Height = "Low" | "Mid" | "High";
