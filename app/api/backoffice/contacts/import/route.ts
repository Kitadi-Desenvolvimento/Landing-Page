import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

interface ImportedContact {
  name: string;
  email: string;
  phone: string;
  company?: string;
  area?: string;
  notes?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
  // Accept various phone formats: +244923123456, 923123456, etc
  const phoneRegex = /^(\+?244|0)?9\d{8}$/;
  return phoneRegex.test(phone.replace(/\s|-/g, ""));
}

function normalizePhone(phone: string): string {
  // Remove spaces and hyphens
  let normalized = phone.replace(/\s|-/g, "");
  // If starts with 0, remove it and add +244
  if (normalized.startsWith("0")) {
    normalized = "+244" + normalized.substring(1);
  }
  // If doesn't start with +, assume Angola code
  if (!normalized.startsWith("+")) {
    normalized = "+244" + normalized;
  }
  return normalized;
}

function validateContact(row: any, index: number): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
    errors.push(`Linha ${index + 1}: Nome é obrigatório`);
  }

  if (!row.email || typeof row.email !== "string" || !row.email.trim()) {
    errors.push(`Linha ${index + 1}: Email é obrigatório`);
  } else if (!validateEmail(row.email.trim())) {
    errors.push(`Linha ${index + 1}: Email inválido: ${row.email}`);
  }

  if (!row.phone || typeof row.phone !== "string" || !row.phone.trim()) {
    errors.push(`Linha ${index + 1}: Telefone é obrigatório`);
  } else if (!validatePhone(row.phone.trim())) {
    errors.push(`Linha ${index + 1}: Formato de telefone inválido: ${row.phone}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mappingStr = formData.get("mapping") as string;

    if (!file) {
      return NextResponse.json({ error: "Ficheiro não encontrado" }, { status: 400 });
    }

    // Parse mapping
    const mapping = JSON.parse(mappingStr);

    // Read file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Map columns
    const contacts: ImportedContact[] = [];
    const validationErrors: string[] = [];
    const duplicates: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row: any = rawData[i];

      const contact: ImportedContact = {
        name: row[mapping.name]?.toString().trim() || "",
        email: row[mapping.email]?.toString().trim().toLowerCase() || "",
        phone: row[mapping.phone]?.toString().trim() || "",
        company: row[mapping.company]?.toString().trim(),
        area: row[mapping.area]?.toString().trim(),
        notes: row[mapping.notes]?.toString().trim(),
      };

      const validation = validateContact(contact, i);
      if (!validation.valid) {
        validationErrors.push(...validation.errors);
        continue;
      }

      // Normalize phone
      contact.phone = normalizePhone(contact.phone);

      // Check for duplicates within import
      if (contacts.some((c) => c.email === contact.email)) {
        duplicates.push(`Linha ${i + 1}: ${contact.email} aparece múltiplas vezes`);
        continue;
      }

      contacts.push(contact);
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Nenhum contacto válido para importar",
          validationErrors,
          imported: 0,
        },
        { status: 400 }
      );
    }

    // Save to Supabase
    const admin = createSupabaseAdminClient();
    const { data: userData } = await admin.auth.admin.listUsers();
    const currentUser = userData?.users?.[0];

    if (!currentUser) {
      return NextResponse.json({ error: "Utilizador não autenticado" }, { status: 401 });
    }

    // Insert contacts
    const { data: insertedData, error: insertError } = await admin
      .from("crm_opportunities")
      .insert(
        contacts.map((contact) => ({
          name: contact.name,
          company: contact.company || null,
          email: contact.email,
          phone: contact.phone,
          area: contact.area || null,
          notes: (contact.notes ? `[Importado] ${contact.notes}` : "[Importado do Excel]"),
          stage: "new",
          probability: 0,
          amount_kz: 0,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
        }))
      )
      .select();

    if (insertError) {
      return NextResponse.json(
        {
          error: `Erro ao salvar: ${insertError.message}`,
          details: insertError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${contacts.length} contacto(s) importado(s) com sucesso`,
      imported: contacts.length,
      validationErrors,
      duplicatesWithinImport: duplicates,
      data: insertedData,
    });
  } catch (error) {
    console.error("[import-contacts] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
