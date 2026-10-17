"use client";

import { useState } from "react";
import { TaskForm, type TaskFormValues } from "@/components/task-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { TaskView } from "@/lib/schemas/voting";
import { editTask, newTask } from "@/server/rooms";

type Props = {
  roomId: string;
  task: TaskView | null;
  isModerator: boolean;
  hasModerator: boolean;
  // La tarea cambió: volver a pedir el estado (el broadcast también llega a los demás)
  onChanged: () => void;
};

const SAVE_ERROR = "No se pudo guardar la tarea. Inténtalo de nuevo.";

// Tarea actual de la sala: la ve todo el mundo; solo el moderador la carga, edita o reemplaza
// (RF-01, RF-02, RF-08, RF-09, RF-13, RF-14)
export function TaskPanel({ roomId, task, isModerator, hasModerator, onChanged }: Props) {
  const [mode, setMode] = useState<"view" | "new" | "edit">("view");
  // Tarea nueva pendiente de confirmar porque la ronda tiene votos (RF-08)
  const [pending, setPending] = useState<TaskFormValues | null>(null);

  async function submitNew(values: TaskFormValues, discardVotes: boolean): Promise<string | null> {
    const result = await newTask({ roomId, ...values, discardVotes });
    if (result.ok) {
      setPending(null);
      setMode("view");
      onChanged();
      return null;
    }
    if (result.error === "VOTES_PRESENT") {
      setPending(values);
      return null;
    }
    return SAVE_ERROR;
  }

  async function submitEdit(values: TaskFormValues): Promise<string | null> {
    if (!task) return SAVE_ERROR;
    const result = await editTask({ roomId, taskId: task.id, ...values });
    if (!result.ok) return SAVE_ERROR;
    setMode("view");
    onChanged();
    return null;
  }

  const showNewForm = isModerator && (mode === "new" || (!task && mode === "view"));

  return (
    <section aria-label="Tarea" className="flex flex-col gap-3">
      {!hasModerator && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          Esta sala no tiene moderador: se puede votar la tarea actual, pero nadie puede cambiarla.
        </p>
      )}

      {showNewForm ? (
        <TaskForm
          submitLabel="Empezar votación"
          onSubmit={(values) => submitNew(values, false)}
          onCancel={task ? () => setMode("view") : undefined}
        />
      ) : isModerator && mode === "edit" && task ? (
        <TaskForm
          defaultValues={task}
          submitLabel="Guardar"
          onSubmit={submitEdit}
          onCancel={() => setMode("view")}
        />
      ) : task ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold wrap-anywhere">{task.title}</h2>
          {task.detail && (
            <p className="text-sm text-muted-foreground wrap-anywhere">{task.detail}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esperando a que el moderador cargue una tarea.
        </p>
      )}

      {isModerator && task && mode === "view" && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setMode("edit")}>
            Editar tarea
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMode("new")}>
            Nueva tarea
          </Button>
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cargar una nueva tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se perderán los votos de esta ronda y todos volverán a votar la tarea nueva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && void submitNew(pending, true)}>
              Sí, nueva tarea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
