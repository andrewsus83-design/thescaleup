"use client";

import { Trash2 } from "lucide-react";
import { deleteClient } from "@/lib/report/actions";

/** Delete a brand (with confirm). Submits the deleteClient server action. */
export function DeleteBrandButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteClient}
      onSubmit={(e) => {
        if (!confirm(`Hapus brand "${name}"? Semua data & laporannya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title="Hapus brand"
        className="rounded-lg border border-red-200 px-3 py-2 text-red-500 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}
