"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createRoomInput } from "@/lib/schemas/room";
import { createRoom } from "@/server/rooms";

type FormInput = z.input<typeof createRoomInput>;
type FormOutput = z.output<typeof createRoomInput>;

// Formulario de creación de sala (RF-01)
export function CreateRoomForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createRoomInput),
    defaultValues: { roomName: "", nickname: "" },
  });

  async function onSubmit(values: FormOutput) {
    setServerError(null);
    const result = await createRoom(values);
    if (result.ok) {
      router.push(`/r/${result.data.roomId}`);
    } else {
      setServerError("No se pudo crear la sala. Revisa los datos e inténtalo de nuevo.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="roomName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="roomName">Nombre de la sala</FieldLabel>
              <Input
                {...field}
                id="roomName"
                placeholder="Sprint 12"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="nickname"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="nickname">Tu apodo</FieldLabel>
              <Input
                {...field}
                id="nickname"
                placeholder="Ana"
                autoComplete="nickname"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {serverError && <FieldError>{serverError}</FieldError>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creando…" : "Crear sala"}
        </Button>
      </FieldGroup>
    </form>
  );
}
