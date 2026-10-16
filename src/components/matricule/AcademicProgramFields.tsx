"use client";

import { useState } from "react";
import { ESCAE_PROGRAM_CATEGORIES } from "@/config/academic-programs";

interface AcademicProgramFieldsProps {
  idPrefix: string;
  disabled?: boolean;
  inputClassName: string;
  labelClassName: string;
}

export function AcademicProgramFields({
  idPrefix,
  disabled = false,
  inputClassName,
  labelClassName,
}: AcademicProgramFieldsProps) {
  const [categoryLabel, setCategoryLabel] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [openList, setOpenList] = useState<"category" | "program" | null>(null);
  const selectedCategory = ESCAE_PROGRAM_CATEGORIES.find(
    (category) => category.label === categoryLabel,
  );

  return (
    <div className="contents">
      <div
        className="min-w-0 space-y-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpenList(null);
          }
        }}
      >
        <label htmlFor={`${idPrefix}-category`} className={labelClassName}>
          Domaine de formation
        </label>
        <button
          type="button"
          id={`${idPrefix}-category`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={openList === "category"}
          aria-controls={`${idPrefix}-category-options`}
          onClick={() => setOpenList(openList === "category" ? null : "category")}
          className={`${inputClassName} flex min-w-0 max-w-full items-center justify-between gap-3 text-left transition focus:border-[#05F228]/70 focus:outline-none focus:ring-2 focus:ring-[#05F228]/20 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className={`truncate ${categoryLabel ? "text-white" : "text-white/70"}`}>
            {categoryLabel || "Choisissez un domaine"}
          </span>
          <Chevron open={openList === "category"} />
        </button>
        {openList === "category" && (
          <div
            id={`${idPrefix}-category-options`}
            role="listbox"
            aria-label="Domaines de formation"
            className="max-h-56 min-w-0 overflow-y-auto rounded-xl border border-[#03A61C]/30 bg-[#111811] p-1.5 shadow-xl shadow-black/50"
          >
            {ESCAE_PROGRAM_CATEGORIES.map((category, index) => {
              const selected = category.label === categoryLabel;
              return (
                <button
                  key={category.label}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setCategoryLabel(category.label);
                    setSelectedProgram("");
                    setOpenList(null);
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${selected ? "bg-[#03A61C]/15 text-[#8cf294]" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
                >
                  <span className="mt-0.5 w-5 shrink-0 font-mono text-[10px] text-white/30">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 break-words">{category.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="min-w-0 space-y-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpenList(null);
          }
        }}
      >
        <label htmlFor={`${idPrefix}-program`} className={labelClassName}>
          Filière / spécialité
        </label>
        <input type="hidden" name="fieldOfStudy" value={selectedProgram} />
        <button
          type="button"
          id={`${idPrefix}-program`}
          disabled={disabled || !selectedCategory}
          aria-haspopup="listbox"
          aria-expanded={openList === "program"}
          aria-controls={`${idPrefix}-program-options`}
          onClick={() => setOpenList(openList === "program" ? null : "program")}
          className={`${inputClassName} flex min-w-0 max-w-full items-center justify-between gap-3 text-left transition focus:border-[#05F228]/70 focus:outline-none focus:ring-2 focus:ring-[#05F228]/20 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className={`truncate ${selectedProgram ? "text-white" : "text-white/70"}`}>
            {selectedProgram || (selectedCategory ? "Choisissez une spécialité" : "Choisissez d’abord un domaine")}
          </span>
          <Chevron open={openList === "program"} />
        </button>
        {openList === "program" && selectedCategory && (
          <div
            id={`${idPrefix}-program-options`}
            role="listbox"
            aria-label={`Spécialités : ${selectedCategory.label}`}
            className="max-h-56 min-w-0 overflow-y-auto rounded-xl border border-[#03A61C]/30 bg-[#111811] p-1.5 shadow-xl shadow-black/50"
          >
            {selectedCategory.programs.map((program) => {
              const selected = program === selectedProgram;
              return (
                <button
                  key={program}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setSelectedProgram(program);
                    setOpenList(null);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm leading-5 transition ${selected ? "bg-[#03A61C]/15 text-[#8cf294]" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
                >
                  {program}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
