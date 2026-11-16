"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { addStore, deleteProduct, deleteStore, saveProduct } from "@/lib/hub/products-actions";
import { KIND_LABEL, LIMITS, STORE_KINDS, type CatalogItem, type StoreKind } from "@/lib/hub/products/model";

/** Adds a store. The fields are controlled so a failed add never loses what was typed; they clear once it works. */
export function AddStoreForm({ brandId }: { brandId: string }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StoreKind>("desty");
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await addStore(prev, fd);
    if (r.message) setName("");
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone="ok" role="status">
          {state.message}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div>
          <label htmlFor="store-name" className={labelCls}>
            Store name
          </label>
          <input id="store-name" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} required placeholder="Desty, main outlet, Shopify shop…" className={inputCls} />
        </div>
        <div>
          <label htmlFor="store-kind" className={labelCls}>
            Kind
          </label>
          <select id="store-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as StoreKind)} className={`${compactField} h-14 w-full rounded-field`}>
            {STORE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <Btn type="submit" variant="primary" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Add store
        </Btn>
      </div>
    </form>
  );
}

/** Deleting asks first, in place, and says what goes. */
export function DeleteStore({ brandId, id, name, products }: { brandId: string; id: string; name: string; products: number }) {
  return (
    <details>
      <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Remove</summary>
      <form action={deleteStore} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="id" value={id} />
        <p className="text-small text-ink-800">
          Removes {name} and the stock numbers it holds{products > 0 ? ` for ${products} ${products === 1 ? "product" : "products"}` : ""}. The products stay in the catalog. This cannot be undone; importing the file again brings the numbers back.
        </p>
        <Btn type="submit" variant="danger" size="sm">
          Remove {name.length > 30 ? `${name.slice(0, 29)}…` : name}
        </Btn>
      </form>
    </details>
  );
}

/** A product's own name, price and low-stock level. Stock itself comes from the stores. */
export function ProductForm({ brandId, item }: { brandId: string; item: CatalogItem }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="id" value={item.id} />
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone="ok" role="status">
          {state.message}
        </Alert>
      )}
      <div>
        <label htmlFor="p-name" className={labelCls}>
          Name
        </label>
        <input id="p-name" name="name" defaultValue={item.name} maxLength={LIMITS.productName} className={inputCls} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-price" className={labelCls}>
            Price
          </label>
          <input id="p-price" name="price" inputMode="decimal" defaultValue={item.price ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="p-low" className={labelCls}>
            Count as low at or below
          </label>
          <input id="p-low" name="low" inputMode="numeric" defaultValue={item.low ?? ""} placeholder="5" className={inputCls} />
        </div>
      </div>
      <Btn type="submit" variant="primary" size="md" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Save changes
      </Btn>
    </form>
  );
}

export function DeleteProduct({ brandId, id, label }: { brandId: string; id: string; label: string }) {
  return (
    <details className="mt-8 border-t border-hairline pt-4">
      <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Delete this product</summary>
      <form action={deleteProduct} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="id" value={id} />
        <p className="text-small text-ink-800">“{label.length > 60 ? `${label.slice(0, 59)}…` : label}” and its stock in every store are removed. Importing a file that lists it again adds it back.</p>
        <Btn type="submit" variant="danger" size="sm">
          Delete it
        </Btn>
      </form>
    </details>
  );
}
