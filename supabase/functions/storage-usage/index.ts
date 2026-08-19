// supabase/functions/storage-usage/index.ts
//
// دروازه‌ی امن مانیتورینگ Storage — فقط Super Admin.
//
// همه‌ی محاسبات (مصرف کل، مصرف هر شرکت، تفکیک هر bucket) از طریق سه تابع
// SQL که در همین migration ساخته شده‌اند انجام می‌شود (get_storage_totals،
// get_storage_usage_by_company، get_storage_by_bucket) — این‌ها عمداً از
// anon/authenticated بسته شده‌اند و فقط از اینجا، با service_role، صدا
// زده می‌شوند. service_role key هرگز به کلاینت فرستاده نمی‌شود.
//
// ظرفیت کل Supabase از یک API رسمی قابل‌خواندن نیست (این یک محدودیت پلن
// اشتراک است، نه یک عدد queryable) — طبق الزام صریح، این عدد را به‌عنوان
// یک «تنظیمات سیستم» قابل‌ویرایش توسط Super Admin نگه می‌داریم، نه به‌عنوان
// چیزی که از خودِ Supabase گرفته شده باشد.
//
// Deploy:
//   supabase functions deploy storage-usage

import { getCallerClaims } from "../_shared/jwtUtils.ts";
import { json, CORS_HEADERS, callRpc, restFetch } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const claims = await getCallerClaims(req);
  if (!claims || claims.is_super_admin !== true) {
    return json({ error: "دسترسی غیرمجاز — این عملیات فقط برای Super Admin مجاز است." }, 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = String(body?.action || "read");

  try {
    // ---------- تنظیم ظرفیت کل (تنظیمات سیستم، نه از Supabase) ----------
    if (action === "set_capacity") {
      const mb = Number(body?.capacityMb);
      if (!mb || mb <= 0) return json({ error: "مقدار ظرفیت نامعتبر است" }, 400);
      const result = await restFetch(
        `system_settings?key=eq.storage_total_capacity_mb`,
        { method: "PATCH", body: JSON.stringify({ value_numeric: mb, updated_at: new Date().toISOString(), updated_by: claims.username || "super_admin" }) }
      );
      if (!result.ok) return json({ error: "خطا در ذخیره‌ی ظرفیت" }, 500);
      return json({ ok: true });
    }

    // ---------- خواندن وضعیت کامل Storage ----------
    const [totalsRes, byCompanyRes, byBucketRes, capacityRes, companiesRes] = await Promise.all([
      callRpc("get_storage_totals", {}),
      callRpc("get_storage_usage_by_company", {}),
      callRpc("get_storage_by_bucket", {}),
      restFetch("system_settings?key=eq.storage_total_capacity_mb&select=value_numeric,updated_at"),
      restFetch("companies?select=id,name,storage_quota_mb"),
    ]);

    const totals = totalsRes.ok && Array.isArray(totalsRes.data) && totalsRes.data.length > 0
      ? totalsRes.data[0] : { total_bytes: 0, total_objects: 0 };
    const byCompany = byCompanyRes.ok && Array.isArray(byCompanyRes.data) ? byCompanyRes.data : [];
    const byBucket = byBucketRes.ok && Array.isArray(byBucketRes.data) ? byBucketRes.data : [];
    const capacityRow = capacityRes.ok && Array.isArray(capacityRes.data) && capacityRes.data.length > 0 ? capacityRes.data[0] : null;
    const companies = companiesRes.ok && Array.isArray(companiesRes.data) ? companiesRes.data : [];

    const usageByCompanyId: Record<string, number> = {};
    byCompany.forEach((r: any) => { usageByCompanyId[r.company_id] = Number(r.bytes_used) || 0; });

    const perCompany = companies.map((c: any) => ({
      companyId: c.id,
      companyName: c.name,
      allocatedMb: c.storage_quota_mb ?? 500,
      usedBytes: usageByCompanyId[c.id] || 0,
    }));

    return json({
      totalBytesUsed: Number(totals.total_bytes) || 0,
      totalObjects: Number(totals.total_objects) || 0,
      capacityMb: capacityRow ? Number(capacityRow.value_numeric) : null,
      capacityUpdatedAt: capacityRow ? capacityRow.updated_at : null,
      byBucket: byBucket.map((b: any) => ({ bucket: b.bucket_id, bytesUsed: Number(b.bytes_used) || 0, objectCount: Number(b.object_count) || 0 })),
      byCompany: perCompany,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: "خطای داخلی: " + String((e as Error)?.message || e) }, 500);
  }
});
