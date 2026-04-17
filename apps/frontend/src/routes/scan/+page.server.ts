import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return { success: false, message: "Token tidak ditemukan." };
  }

  return {
    success: true,
    message: "Kehadiran berhasil dicatat!",
  };
};
