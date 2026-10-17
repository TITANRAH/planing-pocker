"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { taskTitleSchema } from "@/lib/schemas/voting";

const formSchema = z.object({
  title: taskTitleSchema,
  detail: z.string().trim().max(300, "El detalle no puede superar los 300 caracteres"),
});
type FormInput = z.input<typeof formSchema>;
export type TaskFormValues = z.output<typeof formSchema>;

type Props = {
  defaultValues?: { title: string; detail: string | null };
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => Promise<string | null>;
  onCancel?: () => void;
};

// Formulario de la tarea (RF-01, RF-13). `onSubmit` devuelve un mensaje de error o null
export function TaskForm({ defaultValues, submitLabel, onSubmit, onCancel }: Props) {
  const form = useForm<FormInput, unknown, TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: defaultValues?.title ?? "", detail: defaultValues?.detail ?? "" },
  });

  async function submit(values: TaskFormValues) {
    const error = await onSubmit(values);
    if (error) form.setError("root", { message: error });
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <FieldGroup>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="task-title">Título de la tarea</FieldLabel>
              <Input
                {...field}
                id="task-title"
                placeholder="Login con Google"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="detail"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="task-detail">Detalle (opcional)</FieldLabel>
              <Textarea
                {...field}
                id="task-detail"
                placeholder="Link al ticket o una descripción breve"
                rows={2}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}
