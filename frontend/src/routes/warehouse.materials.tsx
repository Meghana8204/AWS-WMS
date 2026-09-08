import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Boxes,
  Search,
  Filter,
  Loader2,
  Plus,
  Edit,
  CheckCircle2,
  XCircle,
  Layers,
  ChevronRight,
  Database,
  Tag,
  Hash,
  Trash2,
  Save,
  X,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  SlidersHorizontal,
  Info,
  RefreshCw,
  Download,
  LayoutGrid,
  List,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  Sliders,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { StatCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/warehouse/materials")({
  head: () => ({
    meta: [
      { title: "Material Master · NexusWMS" },
      {
        name: "description",
        content:
          "Manage canonical Material Master codes, SKU specifications, stock units, and procurement mappings.",
      },
    ],
  }),
  component: WarehouseMaterials,
});

const DEFAULT_UOMS = [
  "INGOT",
  "ROLL",
  "COIL",
  "LENGTH",
  "BUNDLE",
  "TON",
  "PCS",
  "MTR",
  "KG",
  "LTR",
  "BOX",
  "PKT",
  "ROL",
  "SQM",
  "SET",
  "NOS",
  "DRUM",
];

// Helper to format specification codes to use "S" for user display
export const formatSpecCode = (code?: string): string => {
  if (!code) return "";
  return code.replace(/-V(\d+)$/i, "-S$1");
};

interface VariantItem {
  variant_code?: string;
  size: string;
  color: string;
  grade: string;
  specification: string;
  uom: string;
  attributes: Record<string, string>;
  status: string;
}

function WarehouseMaterials() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [categories, setCategories] = useState<string[]>([]);
  const [uoms, setUoms] = useState<string[]>([]);

  // UI state: Table vs Cards view & clipboard copy tracking
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals & Dialog states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for creating Material
  const [materialCode, setMaterialCode] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [baseUom, setBaseUom] = useState("");
  const [materialStatus, setMaterialStatus] = useState("Active");

  // Multi-variants/specifications builder inside Create Material
  const [variantsList, setVariantsList] = useState<VariantItem[]>([
    {
      variant_code: "",
      size: "",
      color: "",
      grade: "",
      specification: "",
      uom: "",
      attributes: {},
      status: "Active",
    },
  ]);

  // Attribute Key-Value input for new specification modal
  const [attrKey, setAttrKey] = useState("");
  const [attrVal, setAttrVal] = useState("");

  // Single new specification form for existing material
  const [newVarSize, setNewVarSize] = useState("");
  const [newVarColor, setNewVarColor] = useState("");
  const [newVarGrade, setNewVarGrade] = useState("");
  const [newVarSpec, setNewVarSpec] = useState("");
  const [newVarUom, setNewVarUom] = useState("");
  const [newVarCode, setNewVarCode] = useState("");
  const [newVarAttrs, setNewVarAttrs] = useState<Record<string, string>>({});

  const fetchMaterialsData = async () => {
    try {
      setLoading(true);
      const [matData, catData, uomData] = await Promise.all([
        api.getMaterials({
          search: searchTerm || undefined,
          category: selectedCategory !== "ALL" ? selectedCategory : undefined,
          status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        }),
        api.getMaterialCategories().catch(() => []),
        api.getMaterialUoms().catch(() => []),
      ]);
      setMaterials(matData);
      if (catData.length > 0) setCategories(catData);
      if (uomData.length > 0) setUoms(uomData);
    } catch (err: any) {
      console.error("Failed to load materials:", err);
      toast.error("Failed to load Material Master data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterialsData();
  }, [selectedCategory, selectedStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMaterialsData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcut: Pressing '/' focuses the search bar; Alt+N opens Add Material
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        openCreateModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCopyCode = (code: string, label: string = "Code") => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`${label} "${code}" copied to clipboard!`);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleExportCSV = () => {
    if (!materials || materials.length === 0) {
      toast.info("No material records available to export.");
      return;
    }
    const rows: string[] = [];
    rows.push(
      [
        "Material Code",
        "Material Name",
        "Category",
        "Base UOM",
        "Material Status",
        "Specification Code",
        "Size",
        "Color",
        "Grade",
        "Technical Specification",
        "Specification UOM",
        "Specification Status",
      ].map((h) => `"${h}"`).join(",")
    );

    materials.forEach((mat) => {
      const variants = mat.variants && mat.variants.length > 0 ? mat.variants : [null];
      variants.forEach((v: any) => {
        rows.push(
          [
            mat.material_code || "",
            mat.material_name || "",
            mat.category || "",
            mat.base_uom || "",
            mat.status || "",
            v ? formatSpecCode(v.variant_code) : "",
            v?.size || "",
            v?.color || "",
            v?.grade || "",
            v?.specification || "",
            v?.uom || mat.base_uom || "",
            v?.status || "",
          ]
            .map((field) => `"${String(field).replace(/"/g, '""')}"`)
            .join(",")
        );
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `NexusWMS_Material_Master_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Material Master catalog exported to CSV!");
  };

  const openCreateModal = async () => {
    try {
      const { suggested_material_code, suggested_variant_code } = await api.getNextMaterialCode();
      const code = suggested_material_code || "MAT-001";
      const specCode = formatSpecCode(suggested_variant_code) || `${code}-S001`;
      setMaterialCode(code);
      setMaterialName("");
      setDescription("");
      setBaseUom(uoms[0] || "NOS");
      setMaterialStatus("Active");
      setCustomCategory("");
      setVariantsList([
        {
          variant_code: specCode,
          size: "",
          color: "",
          grade: "",
          specification: "",
          uom: uoms[0] || "NOS",
          attributes: {},
          status: "Active",
        },
      ]);
      setIsAddModalOpen(true);
    } catch (e) {
      setMaterialCode("MAT-001");
      setVariantsList([
        {
          variant_code: "MAT-001-S001",
          size: "",
          color: "",
          grade: "",
          specification: "",
          uom: uoms[0] || "NOS",
          attributes: {},
          status: "Active",
        },
      ]);
      setIsAddModalOpen(true);
    }
  };

  const addVariantRow = () => {
    const codePrefix = materialCode.trim().toUpperCase() || "MAT";
    const existingSeqs = variantsList
      .map((v) => {
        const match =
          v.variant_code?.match(/[-_]?[vVsS](\d+)$/) || v.variant_code?.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
    const nextCode = `${codePrefix}-S${String(maxSeq + 1).padStart(3, "0")}`;
    setVariantsList([
      ...variantsList,
      {
        variant_code: nextCode,
        size: "",
        color: "",
        grade: "",
        specification: "",
        uom: baseUom || uoms[0] || "NOS",
        attributes: {},
        status: "Active",
      },
    ]);
  };

  const removeVariantRow = (idx: number) => {
    if (variantsList.length === 1) {
      toast.info("A material must have at least one specification.");
      return;
    }
    setVariantsList(variantsList.filter((_, i) => i !== idx));
  };

  const updateVariantRow = (idx: number, field: keyof VariantItem, value: any) => {
    const current = variantsList[idx];
    if (!current) return;
    const updated = [...variantsList];
    updated[idx] = { ...current, [field]: value };
    setVariantsList(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialCode.trim()) {
      toast.error("Material Code is required");
      return;
    }
    if (!materialName.trim()) {
      toast.error("Material Name is required");
      return;
    }

    const trimmedName = materialName.trim().toLowerCase();
    const existingMat = materials.find(
      (m) => m.material_name?.trim().toLowerCase() === trimmedName,
    );
    if (existingMat) {
      toast.error(
        `Material "${existingMat.material_name}" already exists (${existingMat.material_code}). Please use a unique Material Name.`,
      );
      return;
    }

    const finalCategory = category === "OTHER" ? customCategory.trim() : category;
    if (!finalCategory) {
      toast.error("Please specify a category");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        material_code: materialCode.trim().toUpperCase(),
        material_name: materialName.trim(),
        category: finalCategory,
        description: description.trim() || undefined,
        base_uom: baseUom,
        status: materialStatus,
        variants: variantsList.map((v, i) => ({
          variant_code:
            v.variant_code?.trim().toUpperCase() ||
            `${materialCode.trim().toUpperCase()}-S${String(i + 1).padStart(3, "0")}`,
          size: v.size.trim() || undefined,
          color: v.color.trim() || undefined,
          grade: v.grade.trim() || undefined,
          specification: v.specification.trim() || undefined,
          uom: v.uom || baseUom,
          attributes: v.attributes,
          status: v.status || "Active",
        })),
      };

      await api.createMaterial(payload);
      toast.success(
        `Material ${payload.material_code} (${payload.material_name}) created with ${payload.variants.length} specification(s)!`,
      );
      setIsAddModalOpen(false);
      fetchMaterialsData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create material");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMaterialStatus = async (material: any) => {
    const newStatus = material.status === "Active" ? "Inactive" : "Active";
    try {
      await api.updateMaterialStatus(material.id, newStatus);
      toast.success(`Material ${material.material_code} marked as ${newStatus}`);
      fetchMaterialsData();
      if (selectedMaterial && selectedMaterial.id === material.id) {
        setSelectedMaterial({ ...selectedMaterial, status: newStatus });
      }
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleToggleVariantStatus = async (variant: any) => {
    if (!selectedMaterial) return;
    const newStatus = variant.status === "Active" ? "Inactive" : "Active";
    try {
      await api.updateMaterialVariantStatus(selectedMaterial.id, variant.id, newStatus);
      toast.success(`Specification ${formatSpecCode(variant.variant_code)} marked as ${newStatus}`);
      const updated = await api.getMaterial(selectedMaterial.id);
      setSelectedMaterial(updated);
      fetchMaterialsData();
    } catch (err: any) {
      toast.error("Failed to update specification status: " + err.message);
    }
  };

  const handleRemoveVariant = async (variant: any) => {
    if (!selectedMaterial) return;
    if ((selectedMaterial.variants?.length || 0) <= 1) {
      toast.error("Cannot remove the only specification of a material. A material must retain at least one specification.");
      return;
    }
    if (!window.confirm(`Are you sure you want to remove specification "${formatSpecCode(variant.variant_code)}"?`)) {
      return;
    }
    try {
      await api.deleteMaterialVariant(selectedMaterial.id, variant.id);
      toast.success(`Specification ${formatSpecCode(variant.variant_code)} removed successfully`);
      const updated = await api.getMaterial(selectedMaterial.id);
      setSelectedMaterial(updated);
      fetchMaterialsData();
    } catch (err: any) {
      toast.error("Failed to remove specification: " + (err.message || "Unknown error"));
    }
  };

  const openMaterialDetail = async (mat: any) => {
    try {
      const full = await api.getMaterial(mat.id);
      setSelectedMaterial(full);
      setIsDetailModalOpen(true);
    } catch (e) {
      setSelectedMaterial(mat);
      setIsDetailModalOpen(true);
    }
  };

  const openAddVariantForExisting = async (mat?: any) => {
    const target = mat || selectedMaterial;
    if (!target) return;
    if (mat) {
      setSelectedMaterial(mat);
    }
    // Extract existing sequences from all existing variant/specification codes
    const existingSeqs = (target.variants || [])
      .map((v: any) => {
        const match =
          v.variant_code?.match(/[-_]?[vVsS](\d+)$/) || v.variant_code?.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n: number) => !isNaN(n) && n > 0);
    const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
    const initialCode = `${target.material_code}-S${String(maxSeq + 1).padStart(3, "0")}`;

    setNewVarCode(initialCode);
    setNewVarSize("");
    setNewVarColor("");
    setNewVarGrade("");
    setNewVarSpec("");
    setNewVarUom(target.base_uom || uoms[0] || "");
    setNewVarAttrs({});
    setAttrKey("");
    setAttrVal("");
    setIsAddVariantModalOpen(true);

    // Also fetch suggested code from backend API to ensure 100% synchronization
    try {
      const res = await api.getNextVariantCode(target.id);
      if (res?.suggested_variant_code) {
        setNewVarCode(formatSpecCode(res.suggested_variant_code));
      }
    } catch {
      // Keep calculated fallback
    }
  };

  const handleAddVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    setSubmitting(true);
    try {
      const payload = {
        variant_code: newVarCode.trim().toUpperCase() || undefined,
        size: newVarSize.trim() || undefined,
        color: newVarColor.trim() || undefined,
        grade: newVarGrade.trim() || undefined,
        specification: newVarSpec.trim() || undefined,
        uom: newVarUom || selectedMaterial.base_uom,
        attributes: newVarAttrs,
        status: "Active",
      };

      await api.addMaterialVariant(selectedMaterial.id, payload);
      toast.success(`Specification added to ${selectedMaterial.material_code}!`);
      setIsAddVariantModalOpen(false);
      const updated = await api.getMaterial(selectedMaterial.id);
      setSelectedMaterial(updated);
      fetchMaterialsData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add specification");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAttribute = () => {
    if (!attrKey.trim() || !attrVal.trim()) return;
    setNewVarAttrs({ ...newVarAttrs, [attrKey.trim().toLowerCase()]: attrVal.trim() });
    setAttrKey("");
    setAttrVal("");
  };

  const handleRemoveAttribute = (key: string) => {
    const copy = { ...newVarAttrs };
    delete copy[key];
    setNewVarAttrs(copy);
  };

  // Stats calculation
  const totalMaterials = materials.length;
  const totalVariants = materials.reduce(
    (acc, m) => acc + (m.variant_count || m.variants?.length || 0),
    0,
  );
  const activeCount = materials.filter((m) => m.status === "Active").length;
  const distinctCategories = Array.from(new Set(materials.map((m) => m.category))).length;

  return (
    <AppShell
      title="Material Master"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9.5 rounded-xl px-3 text-xs font-semibold border-border/80 bg-card hover:bg-muted/60 shadow-2xs text-muted-foreground hover:text-foreground"
            onClick={handleExportCSV}
            title="Export catalog to CSV"
          >
            <Download className="size-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9.5 rounded-xl px-3 text-xs font-semibold border-border/80 bg-card hover:bg-muted/60 shadow-2xs text-muted-foreground hover:text-foreground"
            onClick={fetchMaterialsData}
            disabled={loading}
            title="Refresh material catalog"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin text-primary")} />
            Refresh
          </Button>

          <Button
            className="h-9.5 rounded-xl shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 text-xs tracking-tight"
            onClick={openCreateModal}
          >
            <Plus className="mr-1.5 size-4" /> Add Material
            <kbd className="hidden md:inline-flex ml-2 items-center rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[9px] font-medium text-primary-foreground">
              Alt+N
            </kbd>
          </Button>
        </div>
      }
    >
      {/* Executive Metric Cards (Industry-Standard Bento Grid) */}
      <div className="mb-6 grid auto-rows-fr items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Material Masters */}
        <Card className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-2xs transition-all duration-300 hover:border-primary/40 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Material Masters
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/20 shadow-2xs">
              <Database className="size-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-black tracking-tight tabular-nums text-foreground">
              {loading ? "..." : totalMaterials}
            </p>
          </div>
        </Card>

        {/* Card 2: Total Specifications */}
        <Card className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-card to-card p-5 shadow-2xs transition-all duration-300 hover:border-teal-500/40 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Specifications
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-2xs">
              <Layers className="size-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-black tracking-tight tabular-nums text-foreground">
              {loading ? "..." : totalVariants}
            </p>
          </div>
        </Card>

        {/* Card 3: Active Materials */}
        <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-5 shadow-2xs transition-all duration-300 hover:border-emerald-500/40 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Active Materials
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight tabular-nums text-foreground">
                {loading ? "..." : activeCount}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                / {loading ? "..." : totalMaterials}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/15">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
        </Card>

        {/* Card 4: Categories */}
        <Card className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card p-5 shadow-2xs transition-all duration-300 hover:border-amber-500/40 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Categories
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
              <Tag className="size-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-black tracking-tight tabular-nums text-foreground">
              {loading ? "..." : distinctCategories}
            </p>
          </div>
        </Card>
      </div>

      {/* Modern High-End Command & Filter Bar */}
      <div className="mb-6 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-2xs backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Search Input with Clear Button & Shortcut Badge */}
            <div className="relative min-w-[260px] max-w-md flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Search code, name, size, color, grade, specs... (Press /)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-border/70 bg-background/90 pl-10 pr-9 text-xs outline-none focus:ring-2 focus:ring-primary/25"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  title="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-10 w-48 rounded-xl bg-background/90 text-xs font-medium border-border/70">
                <div className="flex items-center gap-1.5 truncate">
                  <Tag className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Categories" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-border/80">
                <SelectItem value="ALL" className="text-xs font-bold">
                  All Categories ({categories.length})
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-10 w-38 rounded-xl bg-background/90 text-xs font-medium border-border/70">
                <div className="flex items-center gap-1.5 truncate">
                  <SlidersHorizontal className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-border/80">
                <SelectItem value="ALL" className="text-xs font-bold">
                  All Status
                </SelectItem>
                <SelectItem value="Active" className="text-xs text-emerald-600 font-medium">
                  Active Only
                </SelectItem>
                <SelectItem value="Inactive" className="text-xs text-muted-foreground">
                  Inactive Only
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Reset Filters Shortcut */}
            {(searchTerm || selectedCategory !== "ALL" || selectedStatus !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-xl px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("ALL");
                  setSelectedStatus("ALL");
                }}
              >
                <X className="mr-1 size-3.5" /> Reset Filters
              </Button>
            )}
          </div>

          {/* Right Toolbar: View Mode Switcher & Count Indicator */}
          <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
            <span className="text-xs text-muted-foreground font-medium">
              Showing <strong className="text-foreground">{materials.length}</strong> of{" "}
              <strong className="text-foreground">{totalMaterials}</strong> materials
            </span>

            {/* View Mode Segmented Control */}
            <div className="flex items-center rounded-xl border border-border/80 bg-background/80 p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-2xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Dense Table View"
              >
                <List className="size-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                  viewMode === "grid"
                    ? "bg-card text-foreground shadow-2xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Card Grid View"
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Material Master Display Area */}
      {loading ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Loading Material Master registry...</p>
        </div>
      ) : materials.length === 0 ? (
        <Card className="flex h-72 flex-col items-center justify-center p-8 text-center border-dashed border-border/80 bg-card/60 rounded-3xl shadow-2xs">
          <div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground mb-3">
            <Boxes className="size-7 opacity-60" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No Materials Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            {searchTerm || selectedCategory !== "ALL" || selectedStatus !== "ALL"
              ? "No materials match your active search or filter criteria. Try clearing filters."
              : "Start by registering your canonical Material Code with specifications for wire, steel, fasteners, or consumables."}
          </p>
          <Button className="mt-5 rounded-xl shadow-glow bg-primary font-bold text-xs" onClick={openCreateModal}>
            <Plus className="mr-1.5 size-4" /> Add Material Master
          </Button>
        </Card>
      ) : viewMode === "table" ? (
        /* HIGH-DENSITY ENTERPRISE TABLE VIEW */
        <Card className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md shadow-2xs">
                <tr className="border-b border-border/80 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 px-4 whitespace-nowrap w-[140px]">Material Code</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[200px] max-w-[280px]">Material Name & Category</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap w-[110px]">Base UOM</th>
                  <th className="py-3.5 px-4 min-w-[320px]">Specifications / SKUs</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap w-[120px]">Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap w-[240px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {materials.map((mat) => {
                  const specCount = mat.variant_count || mat.variants?.length || 0;
                  const isCopied = copiedCode === mat.material_code;

                  return (
                    <tr
                      key={mat.id}
                      className="group hover:bg-muted/25 transition-colors cursor-pointer"
                      onClick={() => openMaterialDetail(mat)}
                    >
                      {/* Code with 1-click copy */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(mat.material_code, "Material Code")}
                            className="font-mono text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1.5 group/code shrink-0"
                            title="Click to copy Material Code"
                          >
                            <span>{mat.material_code}</span>
                            {isCopied ? (
                              <Check className="size-3 text-emerald-600 shrink-0" />
                            ) : (
                              <Copy className="size-3 text-primary/60 group-hover/code:text-primary shrink-0 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Name & Category */}
                      <td className="py-3.5 px-4 min-w-[200px] max-w-[280px] align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm truncate" title={mat.material_name}>
                            {mat.material_name}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/50 shrink-0">
                              <Tag className="size-2.5 text-muted-foreground" /> {mat.category}
                            </span>
                            {mat.description && (
                              <span className="truncate max-w-[180px] text-[11px] text-muted-foreground italic" title={mat.description}>
                                {mat.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Base UOM */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                        <Badge
                          variant="outline"
                          className="rounded-lg font-mono text-[10px] uppercase font-bold border-border/80 bg-muted/30 px-2.5 py-0.5"
                        >
                          {mat.base_uom}
                        </Badge>
                      </td>

                      {/* Specifications Pills */}
                      <td className="py-3.5 px-4 min-w-[320px] align-middle">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-2xl">
                          {mat.variants && mat.variants.length > 0 ? (
                            <>
                              {mat.variants.slice(0, 3).map((v: any) => {
                                const specDesc = [v.size, v.color, v.grade].filter(Boolean).join(" · ");
                                const isInactive = v.status === "Inactive";
                                const specCode = formatSpecCode(v.variant_code);
                                const fullTitle = `${specCode}${specDesc ? ` (${specDesc})` : ""}`;
                                return (
                                  <span
                                    key={v.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMaterialDetail(mat);
                                    }}
                                    title={fullTitle}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors whitespace-nowrap max-w-[260px] cursor-pointer",
                                      isInactive
                                        ? "border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground"
                                        : "border-border/80 bg-background/90 text-foreground hover:border-teal-500/50 hover:bg-teal-500/5"
                                    )}
                                  >
                                    <span className={cn("font-bold shrink-0 whitespace-nowrap", isInactive ? "text-muted-foreground" : "text-teal-600 dark:text-teal-400")}>
                                      {specCode}
                                    </span>
                                    {specDesc && (
                                      <span className="font-sans text-muted-foreground font-normal truncate">
                                        ({specDesc})
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                              {specCount > 3 && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMaterialDetail(mat);
                                  }}
                                  className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-1 rounded-md whitespace-nowrap hover:bg-teal-500/20 cursor-pointer transition-colors"
                                  title={`+${specCount - 3} more specifications (click to view)`}
                                >
                                  +{specCount - 3} more
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No specifications defined</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                        <div className="flex justify-center">
                          <StatusBadge status={mat.status} />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl px-2.5 text-xs font-semibold border-border/80 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200"
                            onClick={() => openMaterialDetail(mat)}
                            title="View material specifications and details"
                          >
                            <Layers className="size-3 mr-1 text-teal-600" />
                            Specs ({specCount})
                            <ChevronRight className="ml-1 size-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-xl px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            onClick={() => openAddVariantForExisting(mat)}
                            title="Quick add specification to this material"
                          >
                            <Plus className="size-3 mr-1" /> Spec
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 rounded-xl px-2 text-[11px] font-medium",
                              mat.status === "Active"
                                ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                : "text-emerald-600 hover:bg-emerald-500/10"
                            )}
                            onClick={() => handleToggleMaterialStatus(mat)}
                            title={mat.status === "Active" ? "Deactivate Material" : "Activate Material"}
                          >
                            {mat.status === "Active" ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* VISUAL BENTO CARD GRID VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((mat) => {
            const specCount = mat.variant_count || mat.variants?.length || 0;
            const isCopied = copiedCode === mat.material_code;

            return (
              <Card
                key={mat.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/75 bg-card/95 hover:bg-card hover:border-primary/40 hover:shadow-soft transition-all duration-200 cursor-pointer p-5"
                onClick={() => openMaterialDetail(mat)}
              >
                <div>
                  {/* Top Bar: Code pill, UOM, and Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(mat.material_code, "Material Code")}
                        className="font-mono text-xs font-black text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1.5 group/code"
                        title="Click to copy Material Code"
                      >
                        <span>{mat.material_code}</span>
                        {isCopied ? (
                          <Check className="size-3 text-emerald-600 shrink-0" />
                        ) : (
                          <Copy className="size-3 text-primary/60 group-hover/code:text-primary shrink-0 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                        )}
                      </button>
                      <Badge
                        variant="outline"
                        className="rounded-lg font-mono text-[10px] uppercase font-bold border-border/80 bg-muted/30"
                      >
                        {mat.base_uom}
                      </Badge>
                    </div>
                    <StatusBadge status={mat.status} />
                  </div>

                  {/* Body: Title & Category */}
                  <div className="mt-3">
                    <h3 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                      {mat.material_name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border/50">
                        <Tag className="size-2.5 text-muted-foreground" /> {mat.category}
                      </span>
                    </div>
                    {mat.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {mat.description}
                      </p>
                    )}
                  </div>

                  {/* Specification Pills Preview */}
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase mb-2">
                      <span className="flex items-center gap-1">
                        <Layers className="size-3 text-teal-600 dark:text-teal-400" /> Specifications ({specCount}):
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {mat.variants && mat.variants.length > 0 ? (
                        <>
                          {mat.variants.slice(0, 3).map((v: any) => {
                            const spec = [v.size, v.color, v.grade].filter(Boolean).join(" · ");
                            const isInactive = v.status === "Inactive";
                            return (
                              <span
                                key={v.id}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-mono font-medium",
                                  isInactive
                                    ? "border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground"
                                    : "border-border/80 bg-background/80 text-foreground"
                                )}
                              >
                                <span className={cn("font-bold", isInactive ? "text-muted-foreground" : "text-teal-600 dark:text-teal-400")}>
                                  {formatSpecCode(v.variant_code)}
                                </span>
                                {spec && <span className="text-muted-foreground font-sans font-normal">({spec})</span>}
                              </span>
                            );
                          })}
                          {specCount > 3 && (
                            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-lg">
                              +{specCount - 3} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No specifications defined</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div
                  className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 rounded-xl text-xs font-semibold border-border/80 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200"
                    onClick={() => openMaterialDetail(mat)}
                  >
                    View Details <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8.5 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-500/10"
                    onClick={() => openAddVariantForExisting(mat)}
                  >
                    <Plus className="size-3.5 mr-1" /> Add Spec
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE MATERIAL & MULTI-SPECIFICATION MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="border-b pb-4 pr-10">
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Plus className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Add Material Master</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Define canonical Material Code with initial specifications for warehouse operations
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-6 pt-3">
            {/* Step 1: Base Material Master Fields */}
            <div className="rounded-2xl bg-muted/20 border border-border/70 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground font-mono text-[10px]">
                  STEP 1
                </Badge>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Base Material Details
                </h4>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Material Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. MAT-001"
                    value={materialCode}
                    readOnly
                    disabled
                    className="font-mono text-sm rounded-xl font-bold bg-muted/60 text-foreground cursor-not-allowed border-dashed"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    System-generated sequential identifier
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold">
                    Material Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Wire, Steel Rod, Hex Bolt, Hydraulic Oil"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="text-sm rounded-xl bg-background"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(val) => {
                      setCategory(val);
                    }}
                  >
                    <SelectTrigger className="rounded-xl text-xs bg-background">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {categories.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="OTHER" className="text-xs font-bold text-primary">
                        + Other / Custom Category
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {category === "OTHER" && (
                    <Input
                      placeholder="Type custom category..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="mt-2 text-xs rounded-xl"
                      required
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Base UOM <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={baseUom}
                    onValueChange={(val) => {
                      setBaseUom(val);
                      setVariantsList(variantsList.map((v) => ({ ...v, uom: val })));
                    }}
                  >
                    <SelectTrigger className="rounded-xl text-xs bg-background font-mono">
                      <SelectValue placeholder="Base UOM" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {uoms.map((u) => (
                        <SelectItem key={u} value={u} className="text-xs font-mono">
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Description / Technical Notes</Label>
                <Textarea
                  placeholder="Optional material description, standard packaging or usage notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl text-xs min-h-[60px] bg-background"
                />
              </div>
            </div>

            {/* Step 2: Multi-Specifications Section */}
            <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-teal-600 text-white font-mono text-[10px]">STEP 2</Badge>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                      Material Specifications
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Each specification has its own unique Specification Code sharing the same Material Code.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariantRow}
                  className="rounded-xl h-8 border-teal-500/40 text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 text-xs font-bold"
                >
                  <Plus className="size-3.5 mr-1" /> Add Specification
                </Button>
              </div>

              <div className="space-y-3">
                {variantsList.map((variant, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs space-y-2.5 transition-all hover:border-teal-500/30"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                          {formatSpecCode(variant.variant_code)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg inline-flex items-center gap-1"
                        onClick={() => removeVariantRow(idx)}
                        disabled={variantsList.length === 1}
                        title={variantsList.length === 1 ? "At least one specification required" : "Remove specification"}
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </Button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-foreground/80">
                          Size / Dimension
                        </Label>
                        <Input
                          value={variant.size}
                          onChange={(e) => updateVariantRow(idx, "size", e.target.value)}
                          placeholder="e.g. 10 mm, 25 kg Ingot"
                          className="h-8.5 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-foreground/80">Color</Label>
                        <Input
                          value={variant.color}
                          onChange={(e) => updateVariantRow(idx, "color", e.target.value)}
                          placeholder="e.g. Red, Metallic Grey"
                          className="h-8.5 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-foreground/80">
                          Grade / Standard
                        </Label>
                        <Input
                          value={variant.grade}
                          onChange={(e) => updateVariantRow(idx, "grade", e.target.value)}
                          placeholder="e.g. Fe 500D, SS 304"
                          className="h-8.5 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-foreground/80">
                          Packaging UOM
                        </Label>
                        <Select
                          value={variant.uom}
                          onValueChange={(val) => updateVariantRow(idx, "uom", val)}
                        >
                          <SelectTrigger className="h-8.5 rounded-xl text-xs font-semibold font-mono bg-background">
                            <SelectValue placeholder="UOM" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {uoms.map((u) => (
                              <SelectItem key={u} value={u} className="text-xs font-mono">
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground/80">
                        Technical Specification / Notes
                      </Label>
                      <Input
                        value={variant.specification}
                        onChange={(e) => updateVariantRow(idx, "specification", e.target.value)}
                        placeholder="e.g. IS 1786 High Ductility TMT Reinforcement (Bundle of 10 Rods)"
                        className="h-8.5 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="border-t pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-xs font-semibold"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl shadow-glow bg-primary hover:bg-primary/90 px-6 font-bold text-xs"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Save Material Master
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DETAIL & SPECIFICATION MANAGEMENT DRAWER/MODAL */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-7 shadow-2xl">
          {selectedMaterial && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4 pr-12">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-2xs">
                    <Boxes className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(selectedMaterial.material_code, "Material Code")}
                        className="font-mono text-sm font-black text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors inline-flex items-center gap-1.5"
                        title="Click to copy Material Code"
                      >
                        <span>{selectedMaterial.material_code}</span>
                        <Copy className="size-3 text-primary/60" />
                      </button>
                      <h2 className="text-lg font-bold text-foreground">
                        {selectedMaterial.material_name}
                      </h2>
                      <StatusBadge status={selectedMaterial.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground/80">
                        {selectedMaterial.category}
                      </span>
                      <span>·</span>
                      <span>
                        Base UOM: <strong className="font-mono">{selectedMaterial.base_uom}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Created:{" "}
                        {selectedMaterial.created_at
                          ? new Date(selectedMaterial.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-8.5 rounded-xl shadow-glow bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                    onClick={() => openAddVariantForExisting(selectedMaterial)}
                  >
                    <Plus className="mr-1 size-3.5" /> Add Specification
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 rounded-xl text-xs font-semibold"
                    onClick={() => handleToggleMaterialStatus(selectedMaterial)}
                  >
                    {selectedMaterial.status === "Active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>

              {selectedMaterial.description && (
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-foreground mr-1">Description:</span>
                  {selectedMaterial.description}
                </div>
              )}

              {/* Specifications List Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-teal-600" />
                    Material Specifications ({selectedMaterial.variants?.length || 0})
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                        <th className="p-3 whitespace-nowrap">Specification Code</th>
                        <th className="p-3 whitespace-nowrap">Size</th>
                        <th className="p-3 whitespace-nowrap">Color</th>
                        <th className="p-3 whitespace-nowrap">Grade</th>
                        <th className="p-3">Specification</th>
                        <th className="p-3 whitespace-nowrap">UOM</th>
                        <th className="p-3 whitespace-nowrap">Status</th>
                        <th className="p-3 text-right whitespace-nowrap pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-medium">
                      {selectedMaterial.variants?.map((v: any) => (
                        <tr key={v.id} className="hover:bg-muted/15 transition-colors">
                          <td className="p-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(formatSpecCode(v.variant_code), "Spec Code")}
                              className="font-mono font-bold text-primary hover:underline inline-flex items-center gap-1"
                              title="Click to copy Specification Code"
                            >
                              <span>{formatSpecCode(v.variant_code)}</span>
                              <Copy className="size-2.5 opacity-50" />
                            </button>
                          </td>
                          <td className="p-3 text-foreground font-medium whitespace-nowrap">{v.size || "—"}</td>
                          <td className="p-3 text-foreground whitespace-nowrap">
                            {v.color ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="size-2.5 rounded-full border border-border inline-block shrink-0"
                                  style={{ backgroundColor: v.color.toLowerCase() }}
                                />
                                <span>{v.color}</span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-foreground font-medium whitespace-nowrap">
                            {v.grade || "—"}
                          </td>
                          <td className="p-3 text-muted-foreground min-w-[150px] max-w-xs">
                            <div className="font-normal">{v.specification || "—"}</div>
                            {v.attributes && Object.keys(v.attributes).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(v.attributes).map(([k, val]) => (
                                  <Badge
                                    key={k}
                                    variant="outline"
                                    className="text-[9px] font-mono px-1.5 py-0 rounded text-muted-foreground/80"
                                  >
                                    {k}: {String(val)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-foreground whitespace-nowrap">
                            {v.uom || selectedMaterial.base_uom}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <StatusBadge status={v.status} />
                          </td>
                          <td className="p-3 text-right whitespace-nowrap pr-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-7 px-2 text-[11px] font-bold rounded-lg transition-colors",
                                  v.status === "Active"
                                    ? "border-border/70 hover:border-destructive/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    : "border-success/40 text-success hover:bg-success-soft",
                                )}
                                onClick={() => handleToggleVariantStatus(v)}
                              >
                                {v.status === "Active" ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] font-bold text-destructive hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-1 rounded-lg transition-colors"
                                onClick={() => handleRemoveVariant(v)}
                                disabled={(selectedMaterial.variants?.length || 0) <= 1}
                                title={
                                  (selectedMaterial.variants?.length || 0) <= 1
                                    ? "A material must retain at least one specification"
                                    : "Remove Specification"
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-semibold"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD SPECIFICATION TO EXISTING MATERIAL MODAL */}
      <Dialog open={isAddVariantModalOpen} onOpenChange={setIsAddVariantModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="border-b pb-3 pr-10">
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
                <Plus className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Add Specification to {selectedMaterial?.material_code}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">{selectedMaterial?.material_name}</p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddVariantSubmit} className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Specification Code</Label>
                <Input
                  value={newVarCode}
                  readOnly
                  disabled
                  placeholder="e.g. MAT-001-S004"
                  className="h-9 font-mono text-xs font-bold rounded-xl bg-muted/60 text-foreground cursor-not-allowed border-dashed"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">UOM</Label>
                <Select value={newVarUom} onValueChange={setNewVarUom}>
                  <SelectTrigger className="h-9 rounded-xl text-xs font-mono">
                    <SelectValue placeholder="UOM" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {uoms.map((u) => (
                      <SelectItem key={u} value={u} className="text-xs font-mono">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Size</Label>
                <Input
                  value={newVarSize}
                  onChange={(e) => setNewVarSize(e.target.value)}
                  placeholder="e.g. 10 mm, 2.5 mm"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Color</Label>
                <Input
                  value={newVarColor}
                  onChange={(e) => setNewVarColor(e.target.value)}
                  placeholder="e.g. Blue, Black"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Grade</Label>
                <Input
                  value={newVarGrade}
                  onChange={(e) => setNewVarGrade(e.target.value)}
                  placeholder="e.g. PVC, IS 2062"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Specification</Label>
              <Input
                value={newVarSpec}
                onChange={(e) => setNewVarSpec(e.target.value)}
                placeholder="Technical notes or special packaging..."
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Extensible Attributes */}
            <div className="rounded-xl bg-muted/30 p-3 border border-border/50 space-y-2">
              <Label className="text-xs font-bold flex items-center gap-1 text-muted-foreground">
                <SlidersHorizontal className="size-3" /> Extensible Custom Attributes (Optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Key (e.g. voltage, thickness)"
                  value={attrKey}
                  onChange={(e) => setAttrKey(e.target.value)}
                  className="h-8 text-xs rounded-lg flex-1 font-mono"
                />
                <Input
                  placeholder="Value (e.g. 440V, 2mm)"
                  value={attrVal}
                  onChange={(e) => setAttrVal(e.target.value)}
                  className="h-8 text-xs rounded-lg flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={handleAddAttribute}
                >
                  Add
                </Button>
              </div>

              {Object.keys(newVarAttrs).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(newVarAttrs).map(([k, val]) => (
                    <Badge
                      key={k}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 rounded-lg flex items-center gap-1"
                    >
                      <span className="font-mono font-bold">{k}:</span> {val}
                      <X
                        className="size-3 cursor-pointer hover:text-destructive ml-1"
                        onClick={() => handleRemoveAttribute(k)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-xs font-semibold"
                onClick={() => setIsAddVariantModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl shadow-glow bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Add Specification
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

