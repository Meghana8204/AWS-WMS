import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, MoreHorizontal, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/material-data")({ component: MaterialMaster });
const TYPES = [
  "Raw Material",
  "Component",
  "Consumable",
  "Packaging Material",
  "Spare Part",
  "Finished Good",
  "Semi-Finished Good",
];
const UOMS = ["Nos", "Kg", "Gm", "Ltr", "Mtr", "Box", "Pack", "Set"];
type Material = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  subCategory: string;
  type: string;
  uom: string;
  status: "Active" | "Inactive";
  used: boolean;
  minimumPrice: string;
  standardPrice: string;
  maximumPrice: string;
  currency: string;
  priceEffectiveFrom: string;
  priceEffectiveTo: string;
  priceThresholdStatus: string;
  approvalRequiredAboveThreshold: boolean;
  lastPurchasePrice: string;
  hsnCode: string;
  gstRate: string;
  minimumStock: string;
  maximumStock: string;
  reorderLevel: string;
  safetyStock: string;
  leadTimeDays: string;
  batchControlled: boolean;
  serialControlled: boolean;
  hazardous: boolean;
  barcode: string;
};
type Form = Omit<Material, "id" | "used">;
const blank: Form = {
  code: "",
  name: "",
  description: "",
  category: "",
  subCategory: "",
  type: "Raw Material",
  uom: "Nos",
  status: "Active",
  minimumPrice: "",
  standardPrice: "",
  maximumPrice: "",
  currency: "INR",
  priceEffectiveFrom: "",
  priceEffectiveTo: "",
  priceThresholdStatus: "Active",
  approvalRequiredAboveThreshold: true,
  lastPurchasePrice: "",
  hsnCode: "",
  gstRate: "",
  minimumStock: "",
  maximumStock: "",
  reorderLevel: "",
  safetyStock: "",
  leadTimeDays: "",
  batchControlled: false,
  serialControlled: false,
  hazardous: false,
  barcode: "",
};
function MaterialMaster() {
  const [items, setItems] = useState<Material[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [type, setType] = useState("all"),
    [status, setStatus] = useState("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const [savedSubCategories, setSavedSubCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [view, setView] = useState<Material | null>(null),
    [form, setForm] = useState<Form>(blank);
  const categories = useMemo(() => [...new Set(items.map((x) => x.category))].sort(), [items]);
  const subCategories = useMemo(
    () =>
      [
        ...new Set([...savedSubCategories, ...items.map((x) => x.subCategory).filter(Boolean)]),
      ].sort(),
    [items, savedSubCategories],
  );
  useEffect(() => {
    Promise.all([api.getMaterials(), api.getMaterialSubCategories()])
      .then(([data, subCategoryData]) => {
        setItems(data.map((x: any) => ({ ...x, used: Boolean(x.used) })));
        setSavedSubCategories(subCategoryData);
      })
      .catch((error) =>
        toast.error("Failed to load material master", {
          description: error instanceof Error ? error.message : undefined,
        }),
      )
      .finally(() => setLoading(false));
  }, []);
  const normalizedQuery = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const matchesQuery = (x: Material) =>
    !normalizedQuery ||
    [x.code, x.name, x.category, x.subCategory].some((value) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .includes(normalizedQuery),
    );
  const suggestions = useMemo(
    () => (normalizedQuery ? items.filter(matchesQuery).slice(0, 8) : []),
    [items, normalizedQuery],
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          matchesQuery(x) &&
          (category === "all" || x.category === category) &&
          (type === "all" || x.type === type) &&
          (status === "all" || x.status.toLowerCase() === status),
      ),
    [items, normalizedQuery, category, type, status],
  );
  const create = async (source?: Material) => {
    let serverSequence = 1;
    try {
      const sequence = await api.getNextMaterialRequestNumber();
      serverSequence = sequence.nextMaterialSequence || 1;
    } catch {
      toast.error("Could not reserve the next material code");
      return;
    }
    const localSequence =
      Math.max(0, ...items.map((x) => Number(x.code.match(/\d+/)?.[0] || 0))) + 1;
    let candidate = Math.max(serverSequence, localSequence);
    let code = `MAT-${String(candidate).padStart(3, "0")}`;
    const usedCodes = new Set(items.map((x) => x.code.trim().toLowerCase()));
    while (usedCodes.has(code.toLowerCase())) {
      candidate += 1;
      code = `MAT-${String(candidate).padStart(3, "0")}`;
    }
    setEditing(null);
    setForm(source ? { ...source, code, name: `${source.name} Copy` } : { ...blank, code });
    setOpen(true);
  };
  const edit = (x: Material) => {
    setEditing(x.id);
    setForm({
      code: x.code,
      name: x.name,
      description: x.description,
      category: x.category,
      subCategory: x.subCategory,
      type: x.type,
      uom: x.uom,
      status: x.status,
      minimumPrice: x.minimumPrice || "",
      standardPrice: x.standardPrice || "",
      maximumPrice: x.maximumPrice || "",
      currency: x.currency || "INR",
      priceEffectiveFrom: x.priceEffectiveFrom || "",
      priceEffectiveTo: x.priceEffectiveTo || "",
      priceThresholdStatus: x.priceThresholdStatus || "Active",
      approvalRequiredAboveThreshold: x.approvalRequiredAboveThreshold !== false,
      lastPurchasePrice: x.lastPurchasePrice || "",
      hsnCode: x.hsnCode || "",
      gstRate: x.gstRate || "",
      minimumStock: x.minimumStock || "",
      maximumStock: x.maximumStock || "",
      reorderLevel: x.reorderLevel || "",
      safetyStock: x.safetyStock || "",
      leadTimeDays: x.leadTimeDays || "",
      batchControlled: Boolean(x.batchControlled),
      serialControlled: Boolean(x.serialControlled),
      hazardous: Boolean(x.hazardous),
      barcode: x.barcode || "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.category.trim()) {
      toast.error("Complete all required fields");
      return;
    }
    if (items.some((x) => x.id !== editing && x.code.toLowerCase() === form.code.toLowerCase())) {
      toast.error("Material code already exists");
      return;
    }
    const minimum = form.minimumPrice ? Number(form.minimumPrice) : null;
    const standard = form.standardPrice ? Number(form.standardPrice) : null;
    const maximum = form.maximumPrice ? Number(form.maximumPrice) : null;
    if (
      (minimum !== null && standard !== null && minimum > standard) ||
      (standard !== null && maximum !== null && standard > maximum) ||
      (minimum !== null && maximum !== null && minimum > maximum)
    ) {
      toast.error("Price range must follow Minimum ≤ Standard ≤ Maximum");
      return;
    }
    if (
      form.priceEffectiveFrom &&
      form.priceEffectiveTo &&
      form.priceEffectiveFrom > form.priceEffectiveTo
    ) {
      toast.error("Price effective-to date must be after effective-from date");
      return;
    }
    try {
      const saved = editing
        ? await api.updateMaterial(editing, form)
        : await api.createMaterial(form);
      setItems((xs) =>
        editing
          ? xs.map((x) => (x.id === editing ? { ...saved, used: x.used } : x))
          : [{ ...saved, used: false }, ...xs],
      );
      toast.success(editing ? "Material updated" : "Material created");
      setOpen(false);
    } catch (error) {
      toast.error(editing ? "Failed to update material" : "Failed to create material", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };
  const toggle = async (m: Material) => {
    const status = m.status === "Active" ? "Inactive" : "Active";
    try {
      const saved = await api.updateMaterial(m.id, { ...m, status });
      setItems((xs) => xs.map((x) => (x.id === m.id ? { ...saved, used: x.used } : x)));
      toast.success(`Material ${status.toLowerCase()}`);
    } catch (error) {
      toast.error("Failed to update material", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };
  const remove = async (m: Material) => {
    if (m.used) {
      toast.error("Used materials cannot be deleted", {
        description: "Deactivate this material instead.",
      });
      return;
    }
    try {
      await api.deleteMaterial(m.id);
      setItems((xs) => xs.filter((x) => x.id !== m.id));
      toast.success("Material deleted");
    } catch (error) {
      toast.error("Failed to delete material", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };
  return (
    <AppShell
      title="Material Master"
      subtitle="Create and manage warehouse material records"
      actions={
        <Button className="rounded-xl shadow-glow" onClick={() => void create()}>
          <Plus className="mr-2 size-4" />
          Add Material
        </Button>
      }
    >
      <Card className="border-border/50 p-4 shadow-soft">
        <div className="relative">
          <Search className="absolute left-3 top-[22px] z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code (MAT-001, 001, 01), name or category..."
            autoComplete="off"
            className="h-11 rounded-xl pl-10"
          />
          {searchFocused && normalizedQuery && (
            <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
              {suggestions.length ? (
                suggestions.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQuery(material.code);
                      setSearchFocused(false);
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <span>
                      <span className="block font-mono text-sm font-bold text-primary">
                        {material.code}
                      </span>
                      <span className="block text-xs text-muted-foreground">{material.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {material.category}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No matching materials found in the backend.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Filter label="Category" value={category} change={setCategory} values={categories} />
          <Filter label="Type" value={type} change={setType} values={TYPES} />
          <Filter
            label="Status"
            value={status}
            change={setStatus}
            values={["active", "inactive"]}
          />
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setCategory("all");
              setType("all");
              setStatus("all");
            }}
          >
            Filter
          </Button>
        </div>
      </Card>
      <Card className="mt-5 overflow-hidden border-border/50 shadow-soft">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground">
            Loading material data from the server...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  {[
                    "Material Code",
                    "Material Name",
                    "Category",
                    "Type",
                    "UOM",
                    "Price Range",
                    "GST %",
                    "Min Stock",
                    "Reorder Level",
                    "Status",
                    "Action",
                  ].map((h) => (
                    <th key={h} className={`px-5 py-4 ${h === "Action" ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-primary">{m.code}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{m.name}</p>
                      <p className="max-w-64 truncate text-xs text-muted-foreground">
                        {m.description}
                      </p>
                    </td>
                    <td className="px-5 py-4">{m.category}</td>
                    <td className="px-5 py-4 text-muted-foreground">{m.type}</td>
                    <td className="px-5 py-4 font-semibold">{m.uom}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                      ₹{Number(m.minimumPrice || 0).toLocaleString()} – ₹
                      {Number(m.maximumPrice || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">{m.gstRate || "—"}</td>
                    <td className="px-5 py-4">{Number(m.minimumStock || 0).toLocaleString()}</td>
                    <td className="px-5 py-4">{Number(m.reorderLevel || 0).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className={
                          m.status === "Active"
                            ? "border-success/30 bg-success-soft text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Actions
                        m={m}
                        view={setView}
                        edit={edit}
                        copy={create}
                        toggle={toggle}
                        remove={remove}
                      />
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={11} className="p-16 text-center text-muted-foreground">
                      No material records returned by the server.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <FormDialog
        open={open}
        close={setOpen}
        form={form}
        setForm={setForm}
        editing={!!editing}
        save={save}
        categories={categories}
        subCategories={subCategories}
        onSubCategoryCreated={(value) =>
          setSavedSubCategories((values) => [...new Set([...values, value])].sort())
        }
      />
      <ViewDialog
        material={view}
        close={() => setView(null)}
        edit={(m) => {
          setView(null);
          edit(m);
        }}
      />
    </AppShell>
  );
}

function Filter({
  label,
  value,
  change,
  values,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  values: string[];
}) {
  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className="w-[185px] rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: All</SelectItem>
        {values.map((v) => (
          <SelectItem key={v} value={v}>
            {v.replace(/^./, (c) => c.toUpperCase())}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Actions({
  m,
  view,
  edit,
  copy,
  toggle,
  remove,
}: {
  m: Material;
  view: (m: Material) => void;
  edit: (m: Material) => void;
  copy: (m: Material) => void | Promise<void>;
  toggle: (m: Material) => void;
  remove: (m: Material) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => view(m)}>
          <Eye className="mr-2 size-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => edit(m)}>
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggle(m)}>
          <Power className="mr-2 size-4" />
          {m.status === "Active" ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copy(m)}>
          <Copy className="mr-2 size-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={m.used} className="text-destructive" onClick={() => remove(m)}>
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function FormDialog({
  open,
  close,
  form,
  setForm,
  editing,
  save,
  categories,
  subCategories,
  onSubCategoryCreated,
}: {
  open: boolean;
  close: (v: boolean) => void;
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  editing: boolean;
  save: () => void;
  categories: string[];
  subCategories: string[];
  onSubCategoryCreated: (value: string) => void;
}) {
  const [addingSubCategory, setAddingSubCategory] = useState(false);
  const [newSubCategory, setNewSubCategory] = useState("");
  const [savingSubCategory, setSavingSubCategory] = useState(false);
  const u = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const addSubCategory = async () => {
    const value = newSubCategory.trim();
    if (!value) {
      toast.error("Enter a category name");
      return;
    }
    setSavingSubCategory(true);
    try {
      const saved = await api.createMaterialSubCategory(value);
      onSubCategoryCreated(saved.name);
      u("subCategory", saved.name);
      setNewSubCategory("");
      setAddingSubCategory(false);
      toast.success("Sub category added");
    } catch (error) {
      toast.error("Failed to add sub category", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingSubCategory(false);
    }
  };
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setAddingSubCategory(false);
      setNewSubCategory("");
    }
    close(value);
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Material" : "Create Material"}</DialogTitle>
          <DialogDescription>Basic Information</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-2 sm:grid-cols-2">
          <Field label="Material Code *">
            <Input value={form.code} readOnly className="bg-muted/50 font-mono" />
            <p className="text-[11px] text-muted-foreground">
              Automatically assigned from the central material sequence.
            </p>
          </Field>
          <Field label="Material Name *">
            <Input value={form.name} onChange={(e) => u("name", e.target.value)} />
          </Field>
          <Field label="Barcode">
            <Input
              value={form.barcode}
              onChange={(e) => u("barcode", e.target.value)}
              placeholder="Scan or enter barcode"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Material Description">
              <Textarea
                value={form.description}
                onChange={(e) => u("description", e.target.value)}
              />
            </Field>
          </div>
          <SelectField
            label="Material Type *"
            value={form.type}
            change={(v) => u("type", v)}
            values={TYPES}
          />
          <Field label="Category *">
            <Input
              list="categories"
              value={form.category}
              onChange={(e) => u("category", e.target.value)}
              placeholder="Select or enter category"
            />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Sub Category">
            <Select
              value={form.subCategory || undefined}
              onValueChange={(value) => {
                if (value === "__add_category__") {
                  setAddingSubCategory(true);
                  return;
                }
                u("subCategory", value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sub category" />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
                <SelectItem value="__add_category__" className="font-semibold text-primary">
                  <Plus className="mr-2 inline size-4" />
                  Add category
                </SelectItem>
              </SelectContent>
            </Select>
            {addingSubCategory && (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  disabled={savingSubCategory}
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addSubCategory();
                    }
                  }}
                  placeholder="New sub category"
                />
                <Button
                  type="button"
                  disabled={savingSubCategory}
                  onClick={() => void addSubCategory()}
                >
                  {savingSubCategory ? "Saving..." : "Add"}
                </Button>
              </div>
            )}
          </Field>
          <SelectField label="UOM *" value={form.uom} change={(v) => u("uom", v)} values={UOMS} />
          <SelectField
            label="Status"
            value={form.status}
            change={(v) => u("status", v)}
            values={["Active", "Inactive"]}
          />
          <div className="sm:col-span-2 border-t pt-4">
            <p className="font-semibold">Material Price Range / Threshold</p>
            <p className="text-xs text-muted-foreground">
              Used to validate supplier quotation prices before PO approval.
            </p>
          </div>
          <Field label="Minimum Price">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.minimumPrice}
              onChange={(e) => u("minimumPrice", e.target.value)}
            />
          </Field>
          <Field label="Standard / Reference Price">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.standardPrice}
              onChange={(e) => u("standardPrice", e.target.value)}
            />
          </Field>
          <Field label="Maximum Price">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.maximumPrice}
              onChange={(e) => u("maximumPrice", e.target.value)}
            />
          </Field>
          <Field label="Last Purchase Price">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.lastPurchasePrice}
              onChange={(e) => u("lastPurchasePrice", e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Input
              maxLength={3}
              value={form.currency}
              onChange={(e) => u("currency", e.target.value.toUpperCase())}
            />
          </Field>
          <SelectField
            label="Threshold Status"
            value={form.priceThresholdStatus}
            change={(v) => u("priceThresholdStatus", v)}
            values={["Active", "Inactive"]}
          />
          <Field label="Effective From">
            <Input
              type="date"
              value={form.priceEffectiveFrom}
              onChange={(e) => u("priceEffectiveFrom", e.target.value)}
            />
          </Field>
          <Field label="Effective To">
            <Input
              type="date"
              value={form.priceEffectiveTo}
              onChange={(e) => u("priceEffectiveTo", e.target.value)}
            />
          </Field>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              checked={form.approvalRequiredAboveThreshold}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  approvalRequiredAboveThreshold: e.target.checked,
                }))
              }
            />
            Additional approval required above threshold
          </label>
          <div className="sm:col-span-2 border-t pt-4">
            <p className="font-semibold">Inventory & Compliance Controls</p>
          </div>
          <Field label="HSN Code">
            <Input value={form.hsnCode} onChange={(e) => u("hsnCode", e.target.value)} />
          </Field>
          <Field label="GST Rate %">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.gstRate}
              onChange={(e) => u("gstRate", e.target.value)}
            />
          </Field>
          <Field label="Minimum Stock">
            <Input
              type="number"
              min="0"
              value={form.minimumStock}
              onChange={(e) => u("minimumStock", e.target.value)}
            />
          </Field>
          <Field label="Reorder Level">
            <Input
              type="number"
              min="0"
              value={form.reorderLevel}
              onChange={(e) => u("reorderLevel", e.target.value)}
            />
          </Field>
          <Field label="Maximum Stock">
            <Input
              type="number"
              min="0"
              value={form.maximumStock}
              onChange={(e) => u("maximumStock", e.target.value)}
            />
          </Field>
          <Field label="Safety Stock">
            <Input
              type="number"
              min="0"
              value={form.safetyStock}
              onChange={(e) => u("safetyStock", e.target.value)}
            />
          </Field>
          <Field label="Lead Time (days)">
            <Input
              type="number"
              min="0"
              value={form.leadTimeDays}
              onChange={(e) => u("leadTimeDays", e.target.value)}
            />
          </Field>
          <div className="space-y-2">
            <Label>Material Controls</Label>
            {[
              ["Batch controlled", "batchControlled"],
              ["Serial controlled", "serialControlled"],
              ["Hazardous", "hazardous"],
            ].map(([label, key]) => (
              <label key={key} className="mr-4 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof Form])}
                  onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? "Save Changes" : "Create Material"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function SelectField({
  label,
  value,
  change,
  values,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  values: string[];
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={change}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
function ViewDialog({
  material,
  close,
  edit,
}: {
  material: Material | null;
  close: () => void;
  edit: (m: Material) => void;
}) {
  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material?.name}</DialogTitle>
          <DialogDescription>{material?.code}</DialogDescription>
        </DialogHeader>
        {material && (
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4 text-sm">
            {[
              ["Category", material.category],
              ["Sub Category", material.subCategory || "—"],
              ["Type", material.type],
              ["UOM", material.uom],
              ["Status", material.status],
              [
                "Minimum Price",
                material.minimumPrice
                  ? `${material.currency} ${Number(material.minimumPrice).toLocaleString()}`
                  : "—",
              ],
              [
                "Standard Price",
                material.standardPrice
                  ? `${material.currency} ${Number(material.standardPrice).toLocaleString()}`
                  : "—",
              ],
              [
                "Maximum Price",
                material.maximumPrice
                  ? `${material.currency} ${Number(material.maximumPrice).toLocaleString()}`
                  : "—",
              ],
              [
                "Price Validity",
                material.priceEffectiveFrom || material.priceEffectiveTo
                  ? `${material.priceEffectiveFrom || "Open"} to ${material.priceEffectiveTo || "Open"}`
                  : "—",
              ],
              ["Threshold Status", material.priceThresholdStatus],
              ["Description", material.description || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-1 font-medium">{v}</p>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {material && (
            <Button onClick={() => edit(material)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
