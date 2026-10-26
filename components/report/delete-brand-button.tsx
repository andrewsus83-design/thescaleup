"use client";

import { Trash2 } from "lucide-react";
import { deleteClient } from "@/lib/report/actions";
import { btnCls } from "@/components/brand/styles";

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
      <button type="submit" title="Hapus brand" className={btnCls("danger", "sm", "gap-2")}>
        <Trash2 className="size-4" aria-hidden /> Hapus
      </button>
    </form>
  );
}
