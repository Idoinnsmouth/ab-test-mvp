import { Trash2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { type EditableVariant } from "./types";

type VariantsTableProps = {
  variants: EditableVariant[];
  onChange: (index: number, key: keyof EditableVariant, value: string) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
};

export function VariantsTable({
  variants,
  onChange,
  onRemove,
  disableRemove,
}: VariantsTableProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <Table>
        <TableHeader>
          <TableRow className="bg-white/2">
            <TableHead className="w-1/3">Key</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant, index) => (
            <TableRow key={variant.id ?? `temp-${index}`}>
              <TableCell>
                <Input
                  value={variant.key}
                  onChange={(event) => onChange(index, "key", event.target.value)}
                  placeholder="A"
                  className="bg-white/5 text-white"
                  maxLength={16}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[
                      typeof variant.weight === "number"
                        ? variant.weight
                        : Number(variant.weight) || 0,
                    ]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) =>
                      onChange(index, "weight", String(value ?? 0))
                    }
                    className="w-full"
                  />
                  <span className="w-12 text-right text-sm text-white">
                    {typeof variant.weight === "number"
                      ? variant.weight
                      : Number(variant.weight) || 0}
                    %
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-400 hover:text-rose-300"
                  onClick={() => onRemove(index)}
                  disabled={disableRemove}
                >
                  <Trash2Icon className="size-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {variants.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-10 text-center text-sm text-zinc-500">
                No variants yet. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
