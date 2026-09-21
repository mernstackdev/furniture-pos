-- One definition of a customer's totals, shared by the customer list and the
-- customer detail page so the two can never disagree.

create view public.customer_summary
with (security_invoker = true)
as
select
  c.id,
  c.name,
  c.phone,
  c.address,
  c.created_at,
  count(s.id)                                                       as order_count,
  coalesce(sum(s.total), 0)::numeric(14, 2)                         as total_spent,
  coalesce(sum(case when s.status = 'unpaid' then s.total end), 0)::numeric(14, 2)
                                                                    as outstanding,
  max(s.sold_at)                                                    as last_order_at,
  -- The most recent sale's method: the "last payment method used" figure.
  (array_agg(s.payment_method order by s.sold_at desc))[1]          as last_payment_method
from public.customers c
left join public.sales s on s.customer_id = c.id
group by c.id;

comment on view public.customer_summary is 'Per-customer purchase totals and the last payment method used.';

revoke all on public.customer_summary from anon, authenticated;
grant select on public.customer_summary to authenticated;
grant select on public.customer_summary to service_role;
