"use client";

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

interface ColumnMapping {
  name: string;
  email: string;
  phone: string;
  company?: string;
  area?: string;
  notes?: string;
}

type Step = "upload" | "mapping" | "preview" | "importing";

export function ImportContactsModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|csv|xls)$/i)) {
      setError("Por favor, seleccione um ficheiro Excel (.xlsx, .xls) ou CSV");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("O ficheiro não pode exceder 5MB");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Parse file to show preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
          setError("O ficheiro está vazio");
          return;
        }

        const columns = Object.keys(data[0] || {});
        setAvailableColumns(columns);
        setRawData(data.slice(0, 10)); // Show first 10 rows for preview

        // Try to auto-detect columns
        const detectedMapping: ColumnMapping = {
          name: columns.find((c) => c.toLowerCase().includes("nome")) || columns[0] || "",
          email:
            columns.find(
              (c) => c.toLowerCase().includes("email") || c.toLowerCase().includes("mail")
            ) || columns[1] || "",
          phone:
            columns.find(
              (c) =>
                c.toLowerCase().includes("telefone") ||
                c.toLowerCase().includes("phone") ||
                c.toLowerCase().includes("telemóvel")
            ) || columns[2] || "",
          company: columns.find((c) => c.toLowerCase().includes("empresa")) || undefined,
          area: columns.find((c) => c.toLowerCase().includes("área")) || undefined,
          notes: columns.find((c) => c.toLowerCase().includes("notas")) || undefined,
        };

        setMapping(detectedMapping);
        setStep("mapping");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler ficheiro");
      }
    };

    reader.readAsBinaryString(selectedFile);
  }, []);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value || undefined }));
  };

  const handleProceedToPreview = () => {
    if (!mapping.name || !mapping.email || !mapping.phone) {
      setError("Por favor, mapear pelo menos Nome, Email e Telefone");
      return;
    }
    setError(null);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));

      const response = await fetch("/api/backoffice/contacts/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao importar contactos");
      }

      setImportResult(data);
      setStep("importing");

      // Auto-close after 3 seconds if successful
      setTimeout(() => {
        onSuccess(data.imported);
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setRawData([]);
    setMapping({ name: "", email: "", phone: "" });
    setError(null);
    setImportResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#e5e0de] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">
            {step === "upload" && "Importar Contactos do Excel"}
            {step === "mapping" && "Mapear Colunas"}
            {step === "preview" && "Pré-visualização"}
            {step === "importing" && "Importação em Progresso"}
          </h2>
          <button
            onClick={handleClose}
            className="text-[#716a69] hover:text-[#1a1a1a] text-2xl leading-none"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#d4cccb] rounded-lg p-8 text-center hover:bg-[#f5f1f0] transition">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="font-medium text-[#1a1a1a]">Arraste ficheiro ou clique para seleccionar</p>
                  <p className="text-sm text-[#716a69]">Excel (.xlsx, .xls) ou CSV</p>
                </label>
              </div>

              {file && (
                <div className="bg-[#f5f1f0] rounded-lg p-4">
                  <p className="text-sm">
                    <span className="font-medium">Ficheiro selecionado:</span> {file.name}
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Mapping Step */}
          {step === "mapping" && (
            <div className="space-y-4">
              <p className="text-sm text-[#716a69]">
                Mapear colunas do ficheiro para os campos do CRM
              </p>

              <div className="space-y-3">
                {["name", "email", "phone", "company", "area", "notes"].map((field) => (
                  <div key={field} className="flex gap-3 items-end">
                    <label className="flex-1">
                      <span className="text-sm font-medium text-[#1a1a1a] block mb-1">
                        {field === "name" && "📝 Nome *"}
                        {field === "email" && "📧 Email *"}
                        {field === "phone" && "📱 Telefone *"}
                        {field === "company" && "🏢 Empresa"}
                        {field === "area" && "🎯 Área"}
                        {field === "notes" && "📝 Notas"}
                      </span>
                      <select
                        value={mapping[field as keyof ColumnMapping] || ""}
                        onChange={(e) =>
                          handleMappingChange(field as keyof ColumnMapping, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-[#d4cccb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                      >
                        <option value="">-- Não mapear --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>

              {/* Preview of first row */}
              {rawData.length > 0 && (
                <div className="bg-[#f5f1f0] rounded-lg p-4 mt-4">
                  <p className="text-xs font-medium text-[#716a69] mb-2">Exemplo do primeiro registo:</p>
                  <div className="space-y-1 text-xs">
                    {mapping.name && (
                      <p>
                        <span className="font-medium">Nome:</span>{" "}
                        {rawData[0]?.[mapping.name] || "—"}
                      </p>
                    )}
                    {mapping.email && (
                      <p>
                        <span className="font-medium">Email:</span>{" "}
                        {rawData[0]?.[mapping.email] || "—"}
                      </p>
                    )}
                    {mapping.phone && (
                      <p>
                        <span className="font-medium">Telefone:</span>{" "}
                        {rawData[0]?.[mapping.phone] || "—"}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-[#716a69]">
                {rawData.length} registo(s) para importar
              </p>

              <div className="border border-[#d4cccb] rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f5f1f0] border-b border-[#d4cccb]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-[#1a1a1a]">Nome</th>
                      <th className="px-3 py-2 text-left font-medium text-[#1a1a1a]">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-[#1a1a1a]">Telefone</th>
                      {mapping.company && (
                        <th className="px-3 py-2 text-left font-medium text-[#1a1a1a]">Empresa</th>
                      )}
                      {mapping.area && (
                        <th className="px-3 py-2 text-left font-medium text-[#1a1a1a]">Área</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#e5e0de] hover:bg-[#fafaf8]">
                        <td className="px-3 py-2 text-[#1a1a1a]">
                          {row[mapping.name] || "—"}
                        </td>
                        <td className="px-3 py-2 text-[#716a69]">
                          {row[mapping.email] || "—"}
                        </td>
                        <td className="px-3 py-2 text-[#716a69]">
                          {row[mapping.phone] || "—"}
                        </td>
                        {mapping.company && (
                          <td className="px-3 py-2 text-[#716a69]">
                            {row[mapping.company] || "—"}
                          </td>
                        )}
                        {mapping.area && (
                          <td className="px-3 py-2 text-[#716a69]">
                            {row[mapping.area] || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Importing Step */}
          {step === "importing" && (
            <div className="space-y-4">
              {importResult?.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-medium text-green-900">{importResult.message}</p>
                  <p className="text-sm text-green-700 mt-2">
                    A janela fechará automaticamente...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4a574]"></div>
                  </div>
                  <p className="text-center text-[#716a69]">
                    A importar contactos...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[#e5e0de] px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-[#d4cccb] text-[#1a1a1a] hover:bg-[#f5f1f0] disabled:opacity-50"
          >
            Cancelar
          </button>

          {step === "mapping" && (
            <button
              onClick={handleProceedToPreview}
              className="px-4 py-2 rounded-lg bg-[#d4a574] text-white hover:bg-[#c09563]"
            >
              Continuar
            </button>
          )}

          {step === "preview" && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#d4a574] text-white hover:bg-[#c09563] disabled:opacity-50"
            >
              {loading ? "A importar..." : "Importar Agora"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
