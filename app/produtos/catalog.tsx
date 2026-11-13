"use client";

import { useMemo, useState } from "react";
import type { ProductListing } from "../course-data";
import ProductCoverCard from "../product-cover-card";

const ALL = "todos";

export default function ProductCatalog({
  courses,
}: {
  courses: ProductListing[];
}) {
  const [category, setCategory] = useState(ALL);
  const [modality, setModality] = useState(ALL);

  const categories = useMemo(
    () => unique(courses.map((course) => course.category)),
    [courses],
  );
  const modalities = useMemo(
    () => unique(courses.map((course) => course.modality)),
    [courses],
  );

  const visible = courses.filter((course) => {
    const categoryMatches = category === ALL || course.category === category;
    const modalityMatches = modality === ALL || course.modality === modality;
    return categoryMatches && modalityMatches;
  });

  return (
    <div>
      <div className="flex flex-col gap-6">
        <FilterGroup
          label="Categoria"
          onChange={setCategory}
          options={categories}
          value={category}
        />
        <FilterGroup
          label="Modalidade"
          onChange={setModality}
          options={modalities}
          value={modality}
        />
      </div>

      <p className="mt-8 text-[14px] text-[#716a69]">
        {visible.length}{" "}
        {visible.length === 1 ? "produto" : "produtos"}
      </p>

      {visible.length > 0 ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <li key={course.slug}>
              <ProductCoverCard course={course} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-[24px] border border-[#e7e1df] bg-white px-6 py-10 text-center text-[16px] italic text-[#716a69]">
          Nenhum produto corresponde a estes filtros.
        </p>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#ae7d32]">
        {label}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        <FilterButton
          active={value === ALL}
          label={label === "Modalidade" ? "Todas" : "Todos"}
          onClick={() => onChange(ALL)}
        />
        {options.map((option) => (
          <FilterButton
            active={value === option}
            key={option}
            label={option}
            onClick={() => onChange(option)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-[40px] items-center rounded-full border px-4 text-[14px] transition-colors ${
        active
          ? "border-[#510f1d] bg-[#510f1d] text-white"
          : "border-[#e7e1df] bg-white text-[#211d1e] hover:border-[#cda45c]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}
