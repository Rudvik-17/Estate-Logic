ALTER TABLE payments
  ADD CONSTRAINT unique_tenant_due_date UNIQUE (tenant_id, due_date);
