import { createSupabaseAdminClient } from "../app/lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

interface CRMRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  stage: string;
  value_kz: number;
  probability: number;
  notes?: string;
  source?: string;
  external_id?: string;
}

interface ImportStats {
  total: number;
  imported: number;
  duplicates_email: { email: string; ids: string[] }[];
  duplicates_phone: { phone: string; ids: string[] }[];
  duplicates_in_crm: { type: string; value: string; ids: string[] }[];
  errors: { id: string; reason: string }[];
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let normalized = phone.replace(/\s|-|\./g, "");

  if (normalized.startsWith("0")) {
    normalized = "+244" + normalized.substring(1);
  } else if (!normalized.startsWith("+")) {
    normalized = "+244" + normalized;
  }

  return normalized;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapStage(etapa: string): string {
  if (!etapa) return "new";

  const lowerStage = etapa.toLowerCase();

  if (lowerStage.includes("fechado ganho")) return "won";
  if (lowerStage.includes("fechado perdido")) return "lost";
  if (lowerStage.includes("qualificado")) return "qualified";
  if (lowerStage.includes("proposta")) return "proposal";
  if (lowerStage.includes("negociação")) return "negotiation";
  if (lowerStage.includes("standby") || lowerStage.includes("stand-by"))
    return "standby";

  return "new";
}

function parseValue(value: string): number {
  if (!value) return 0;
  const cleanValue = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

async function main() {
  const csvPath = path.join(
    process.env.HOME || "/Users/itechzoneao",
    "Downloads",
    "Book(🎯 Pipeline CRM).csv"
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Ficheiro não encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log("📂 Lendo ficheiro CSV...");
  const content = fs.readFileSync(csvPath, "latin1");
  const lines = content.split(/\r?\n/);

  // Skip header rows
  const headers = lines[2].split(";");
  const records: CRMRecord[] = [];
  const emailIndex = headers.indexOf("EMAIL");
  const phoneIndex = headers.indexOf("TELEFONE");
  const nameIndex = headers.indexOf("CLIENTE / EMPRESA / NEGÓCIO");
  const contactIndex = headers.indexOf("PESSOA DE CONTACTO");
  const stageIndex = headers.indexOf("ETAPA FUNIL");
  const valueIndex = headers.indexOf("VALOR POTENCIAL BRUTO");
  const idIndex = headers.indexOf("ID OPORTUNIDADE");
  const notesIndex = headers.indexOf("NOTAS");
  const sourceIndex = headers.indexOf("FONTE LEAD");

  const stats: ImportStats = {
    total: 0,
    imported: 0,
    duplicates_email: [],
    duplicates_phone: [],
    duplicates_in_crm: [],
    errors: [],
  };

  // Parse records
  const rawRecords: any[] = [];
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split(";");
    const id = fields[idIndex]?.trim();

    if (!id) continue;

    const email = normalizeEmail(fields[emailIndex]?.trim() || "");
    const phone = normalizePhone(fields[phoneIndex]?.trim() || "");
    const name =
      fields[nameIndex]?.trim() || fields[contactIndex]?.trim() || "Unknown";

    if (!email && !phone) {
      stats.errors.push({
        id,
        reason: "Sem email nem telefone",
      });
      continue;
    }

    rawRecords.push({
      id,
      name,
      email,
      phone,
      stage: mapStage(fields[stageIndex]?.trim() || ""),
      value_kz: parseValue(fields[valueIndex]?.trim() || "0"),
      probability: 0,
      notes: fields[notesIndex]?.trim() || "",
      source: fields[sourceIndex]?.trim() || "Pipeline Excel",
      external_id: id,
    });

    stats.total++;
  }

  console.log(`✅ ${stats.total} registos lidos`);
  console.log();

  // Check for duplicates within CSV
  const emailMap: Record<string, string[]> = {};
  const phoneMap: Record<string, string[]> = {};

  for (const record of rawRecords) {
    if (record.email) {
      emailMap[record.email] = emailMap[record.email] || [];
      emailMap[record.email].push(record.id);
    }
    if (record.phone) {
      phoneMap[record.phone] = phoneMap[record.phone] || [];
      phoneMap[record.phone].push(record.id);
    }
  }

  for (const [email, ids] of Object.entries(emailMap)) {
    if (ids.length > 1) {
      stats.duplicates_email.push({ email, ids });
      console.log(
        `⚠️  Duplicado por email: ${email} (IDs: ${ids.join(", ")})`
      );
    }
  }

  for (const [phone, ids] of Object.entries(phoneMap)) {
    if (ids.length > 1) {
      stats.duplicates_phone.push({ phone, ids });
      console.log(`⚠️  Duplicado por telefone: ${phone} (IDs: ${ids.join(", ")})`);
    }
  }

  if (stats.duplicates_email.length > 0 || stats.duplicates_phone.length > 0) {
    console.log();
  }

  // Connect to Supabase
  console.log("🔗 Conectando ao Supabase...");
  const admin = createSupabaseAdminClient();

  // Check for duplicates in CRM
  console.log("🔍 Verificando duplicados no CRM...");

  const uniqueRecords = rawRecords.filter((record) => {
    // Keep only first occurrence if duplicate in CSV
    if (record.email && emailMap[record.email]?.length > 1) {
      if (record.id !== emailMap[record.email][0]) return false;
    }
    if (record.phone && phoneMap[record.phone]?.length > 1) {
      if (record.id !== phoneMap[record.phone][0]) return false;
    }
    return true;
  });

  console.log(`📊 ${uniqueRecords.length} registos únicos para verificar`);

  // Check emails in CRM
  if (uniqueRecords.some((r) => r.email)) {
    const emails = uniqueRecords
      .filter((r) => r.email)
      .map((r) => r.email);
    const { data: existingByEmail } = await admin
      .from("crm_opportunities")
      .select("id, email, external_id")
      .in("email", emails);

    if (existingByEmail && existingByEmail.length > 0) {
      console.log(`⚠️  Encontrados ${existingByEmail.length} contactos por email:`);
      for (const existing of existingByEmail) {
        const matchingRecords = uniqueRecords.filter(
          (r) => r.email === existing.email
        );
        console.log(
          `   ${existing.email} → IDs no CRM: ${existing.external_id || existing.id}, IDs no Excel: ${matchingRecords.map((r) => r.id).join(", ")}`
        );
        stats.duplicates_in_crm.push({
          type: "email",
          value: existing.email,
          ids: matchingRecords.map((r) => r.id),
        });
      }
      console.log();
    }
  }

  // Check phones in CRM
  if (uniqueRecords.some((r) => r.phone)) {
    const phones = uniqueRecords
      .filter((r) => r.phone)
      .map((r) => r.phone);
    const { data: existingByPhone } = await admin
      .from("crm_opportunities")
      .select("id, phone, external_id")
      .in("phone", phones);

    if (existingByPhone && existingByPhone.length > 0) {
      console.log(`⚠️  Encontrados ${existingByPhone.length} contactos por telefone:`);
      for (const existing of existingByPhone) {
        const matchingRecords = uniqueRecords.filter(
          (r) => r.phone === existing.phone
        );
        console.log(
          `   ${existing.phone} → IDs no CRM: ${existing.external_id || existing.id}, IDs no Excel: ${matchingRecords.map((r) => r.id).join(", ")}`
        );
      }
      console.log();
    }
  }

  // Insert records (skip duplicates that already exist)
  console.log("💾 Importando novos registos...");

  const toInsert = uniqueRecords.filter((record) => {
    // Simple check: skip if already in duplicates_in_crm
    return !stats.duplicates_in_crm.some((dup) => dup.ids.includes(record.id));
  });

  if (toInsert.length === 0) {
    console.log("⚠️  Nenhum registo novo para importar");
  } else {
    const { data: insertedData, error: insertError } = await admin
      .from("crm_opportunities")
      .insert(
        toInsert.map((record) => ({
          name: record.name,
          email: record.email || null,
          phone: record.phone || null,
          stage: record.stage,
          probability: 0,
          amount_kz: record.value_kz,
          notes: record.notes || `[Importado do Pipeline Excel] ${record.source}`,
          source: record.source,
          external_id: record.external_id,
          created_at: new Date().toISOString(),
        }))
      )
      .select();

    if (insertError) {
      console.error("❌ Erro ao importar:", insertError);
      process.exit(1);
    }

    stats.imported = insertedData?.length || 0;
    console.log(`✅ ${stats.imported} registos importados com sucesso`);
  }

  // Print summary
  console.log();
  console.log("=" + "=".repeat(60));
  console.log("RESUMO DE IMPORTAÇÃO".padStart(50));
  console.log("=" + "=".repeat(60));
  console.log(`Total de registos no Excel:        ${stats.total}`);
  console.log(`Registos importados:               ${stats.imported}`);
  console.log(`Duplicados na importação:          ${stats.duplicates_email.length + stats.duplicates_phone.length}`);
  console.log(
    `  - Por email:                     ${stats.duplicates_email.length}`
  );
  console.log(
    `  - Por telefone:                  ${stats.duplicates_phone.length}`
  );
  console.log(`Duplicados no CRM:                 ${stats.duplicates_in_crm.length}`);
  console.log(`Erros de validação:                ${stats.errors.length}`);
  console.log("=" + "=".repeat(60));
}

main().catch(console.error);
