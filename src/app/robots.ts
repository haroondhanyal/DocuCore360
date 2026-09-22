import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/tools/", "/help"],
      disallow: [
        "/api/",
        "/files",
        "/settings",
        "/admin",
        "/command-center",
        "/dashboard",
        "/history",
        "/recent",
        "/favorites",
        "/reset-password",
        "/verify-email",
      ],
    },
  };
}
