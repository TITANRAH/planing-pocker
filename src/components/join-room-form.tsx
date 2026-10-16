"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { nicknameSchema } from "@/lib/schemas/room";
import type { ActionError } from "@/server/room-service";
import { joinRoom, renameAndResume } from "@/server/rooms";

const formSchema = z.object({ nickname: nicknameSchema });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type Props = {
  roomId: string;
  // "new": primera vez en la sala; "rename": volvió y su apodo anterior está ocupado (RF-09)
  mode: "new" | "rename";
  onJoined: () => void;
  onError: (error: ActionError) => void;
};

// RF-04: entrar a la sala eligiendo un apodo
export function JoinRoomForm({ roomId, mode, onJoined, onError }: Props) {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: "" },
  });

  async function onSubmit({ nickname }: FormOutput) {
    const action = mode === "new" ? joinRoom : renameAndResume;
    const result = await action({ roomId, nickname });
    if (result.ok) return onJoined();
    if (result.error === "NICKNAME_TAKEN") {
      form.setError("nickname", { message: "Ese apodo ya está en uso" });
      return;
    }
    onError(result.error);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">
            {mode === "new" ? "Entrar a la sala" : "Elige otro apodo"}
          </h1>
        </CardTitle>
        <CardDescription>
          {mode === "new"
            ? "Escribe el apodo con el que te verá el resto del equipo."
            : "Alguien está usando tu apodo anterior en esta sala."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="nickname"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="nickname">Tu apodo</FieldLabel>
                  <Input
                    {...field}
                    id="nickname"
                    autoComplete="nickname"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
