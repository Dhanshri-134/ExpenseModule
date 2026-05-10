const COMPANY_ASSET_BUCKET = "company-assets";

function extractAssetPathFromUrl(value = "") {
  const input = String(value || "").trim();
  if (!input) return "";
  const marker = `/${COMPANY_ASSET_BUCKET}/`;
  const index = input.indexOf(marker);
  if (index === -1) return "";
  return input.slice(index + marker.length).split("?")[0];
}

function normalizeMimeExtension(mimeType = "") {
  const normalized = String(mimeType).toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("gif")) return "gif";
  return "bin";
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
    extension: normalizeMimeExtension(match[1]),
  };
}

export async function ensureCompanyAssetBucket(admin) {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw new Error(listError.message || "storage_bucket_list_failed");

  const exists = (buckets || []).some((bucket) => bucket.name === COMPANY_ASSET_BUCKET);
  if (exists) return COMPANY_ASSET_BUCKET;

  const { error: createError } = await admin.storage.createBucket(COMPANY_ASSET_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });

  if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
    throw new Error(createError.message || "storage_bucket_create_failed");
  }

  return COMPANY_ASSET_BUCKET;
}

export function resolveCompanyAssetUrl(admin, assetPath = "") {
  if (!assetPath) return "";
  const { data } = admin.storage.from(COMPANY_ASSET_BUCKET).getPublicUrl(assetPath);
  return data?.publicUrl || "";
}

export async function persistCompanyAsset(admin, { companyId, assetName, value, existingPath = "" }) {
  const input = String(value || "").trim();
  if (!input) {
    return { path: "", url: "" };
  }

  if (!input.startsWith("data:")) {
    return {
      path: extractAssetPathFromUrl(input) || existingPath || "",
      url: input,
    };
  }

  const parsed = parseDataUrl(input);
  if (!parsed) throw new Error("invalid_asset_data");

  await ensureCompanyAssetBucket(admin);
  const assetPath = `${companyId}/${assetName}.${parsed.extension}`;
  const { error: uploadError } = await admin.storage
    .from(COMPANY_ASSET_BUCKET)
    .upload(assetPath, parsed.bytes, {
      contentType: parsed.mimeType,
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message || "asset_upload_failed");

  return {
    path: assetPath,
    url: resolveCompanyAssetUrl(admin, assetPath),
  };
}

export function extractCompanyAssetMetadata(admin, metadata = {}) {
  const safe = metadata && typeof metadata === "object" ? metadata : {};

  const logoPath = safe.logoPath || "";
  const signaturePath = safe.signaturePath || "";
  const stampPath = safe.stampPath || "";

  const logoUrl = resolveCompanyAssetUrl(admin, logoPath) || safe.logoUrl || safe.logoDataUrl || "";
  const signatureUrl = resolveCompanyAssetUrl(admin, signaturePath) || safe.signatureUrl || safe.signatureDataUrl || "";
  const stampUrl = resolveCompanyAssetUrl(admin, stampPath) || safe.stampUrl || safe.stampDataUrl || "";

  return {
    ...safe,
    logoPath,
    logoUrl,
    logoDataUrl: logoUrl,
    signaturePath,
    signatureUrl,
    signatureDataUrl: signatureUrl,
    stampPath,
    stampUrl,
    stampDataUrl: stampUrl,
  };
}
