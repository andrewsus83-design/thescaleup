-- ============================================================================
-- ScaleUp — CRM: optional customer category per contact
-- Categories (segments) are defined in the CRM builder config (customer_categories)
-- with sensible defaults; each contact may optionally carry one. Nullable = optional.
-- ============================================================================
alter table public.crm_contacts add column if not exists category text;
create index if not exists crm_contacts_category_idx on public.crm_contacts (member_id, category);
